/// <reference types="cypress" />

const settings = {
  language: 'en',
  theme: 'paper',
  theme_profiles: '[]',
  layout_mode: 'normal',
  update_interval: '1440',
  last_global_refresh: new Date().toISOString(),
  update_check_enabled: 'false',
  freshrss_enabled: 'false',
  image_gallery_enabled: 'false',
  shortcuts: '{}',
};

const feed = {
  id: 1,
  title: 'Theme verification feed',
  url: 'https://example.com/feed.xml',
  category: 'Verification',
  last_fetched_at: '',
  is_freshrss_source: false,
  is_image_mode: false,
  hide_from_timeline: false,
  last_error: '',
};

function stubInitialApi(): void {
  cy.intercept('GET', '**/api/**', (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/settings') {
      request.reply({ body: settings });
    } else if (path === '/api/feeds') {
      request.reply({ body: [feed] });
    } else if (path === '/api/articles/unread-counts') {
      request.reply({ body: { total: 1, feed_counts: { 1: 1 } } });
    } else if (path === '/api/articles/filter-counts') {
      request.reply({
        body: {
          unread: { 1: 1 },
          favorites: {},
          favorites_unread: {},
          read_later: {},
          read_later_unread: {},
          images: {},
          images_unread: {},
        },
      });
    } else if (path.startsWith('/api/articles')) {
      request.reply({ body: [] });
    } else if (path === '/api/tags' || path === '/api/saved-filters') {
      request.reply({ body: [] });
    } else if (path === '/api/progress') {
      request.reply({ body: { is_running: false, current: 0, total: 0, message: '' } });
    } else if (path === '/api/window/state') {
      request.reply({ body: { width: 1280, height: 720, x: 0, y: 0, maximized: false } });
    } else if (path === '/api/check-updates') {
      request.reply({ body: { has_update: false } });
    } else if (path === '/api/freshrss/status') {
      request.reply({ body: { last_sync_time: '' } });
    } else {
      request.reply({ body: {} });
    }
  });
}

describe('Theme-aware sidebar', () => {
  beforeEach(() => {
    stubInitialApi();
    cy.visit('/', {
      onBeforeLoad(window) {
        window.localStorage.setItem('FeedListPinned', 'false');
        window.localStorage.setItem('FeedListExpanded', 'true');
        window.localStorage.setItem('ActivityBarCollapsed', 'false');
      },
    });
    cy.get('.smart-activity-bar').should('be.visible');
    cy.get('.reader-feed-drawer').should('be.visible');
  });

  it('applies every preset to the sidebar and lets custom shadow color reach the drawer', () => {
    cy.get('.reader-feed-drawer').should('not.have.class', 'is-pinned');
    cy.window().then((window) => {
      const root = window.document.documentElement;
      const rail = window.document.querySelector<HTMLElement>('.smart-activity-bar');
      const drawer = window.document.querySelector<HTMLElement>('.reader-feed-drawer');
      const active = window.document.querySelector<HTMLElement>('[data-active="true"]');
      expect(rail).to.exist;
      expect(drawer).to.exist;
      expect(active).to.exist;
      active!.style.transition = 'none';

      const resolveTokenColor = (token: string) => {
        const probe = window.document.createElement('span');
        probe.style.color = `var(${token})`;
        window.document.body.appendChild(probe);
        const color = window.getComputedStyle(probe).color;
        probe.remove();
        return color;
      };

      const railColors = new Set<string>();
      ['paper', 'ink', 'sepia', 'high-contrast'].forEach((preset) => {
        root.dataset.themePreset = preset;
        void active!.offsetWidth;
        const railColor = window.getComputedStyle(rail!).backgroundColor;
        railColors.add(railColor);
        expect(railColor).to.not.equal('rgba(0, 0, 0, 0)');
        expect(window.getComputedStyle(drawer!).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
        expect(window.getComputedStyle(active!).color).to.equal(
          resolveTokenColor('--accent-text-color')
        );
      });

      expect(railColors.size).to.equal(4);
      root.dataset.themePreset = 'paper';
      const shadowBefore = window.getComputedStyle(drawer!).boxShadow;
      root.style.setProperty('--overlay-shadow-color', '#123456');
      const shadowAfter = window.getComputedStyle(drawer!).boxShadow;
      expect(shadowAfter).to.not.equal(shadowBefore);
    });
  });

  it('temporarily reveals a collapsed desktop rail without opening or moving the feed drawer', () => {
    cy.viewport(1440, 900);
    cy.get('[aria-label="Collapse Activity Bar"]').click();
    cy.get('[data-testid="sidebar-edge-toggle"]').should('have.attr', 'aria-expanded', 'false');

    let collapsedDrawerLeft = 0;
    cy.get('.reader-feed-drawer')
      .should('be.visible')
      .then(($drawer) => {
        collapsedDrawerLeft = $drawer[0].getBoundingClientRect().left;
      });

    cy.get('[data-testid="sidebar-edge-toggle"]')
      .trigger('pointerenter', { pointerType: 'mouse' })
      .should('have.attr', 'aria-expanded', 'true');
    cy.get('.smart-activity-bar').should('be.visible');
    cy.get('.reader-feed-drawer').should(($drawer) => {
      expect($drawer[0].getBoundingClientRect().left).to.equal(collapsedDrawerLeft);
    });

    cy.get('[data-testid="sidebar-edge-toggle"]')
      .focus()
      .should('have.focus')
      .trigger('pointerleave', { pointerType: 'mouse' });
    cy.wait(230);
    cy.get('.smart-activity-bar').should('be.visible');

    cy.get('[data-testid="sidebar-edge-toggle"]').blur();
    cy.wait(230);
    cy.get('.smart-activity-bar').should('not.exist');
    cy.get('[data-testid="sidebar-edge-toggle"]').should('have.attr', 'aria-expanded', 'false');

    cy.get('[data-testid="sidebar-edge-toggle"]').click();
    cy.get('[data-testid="sidebar-edge-toggle"]').should('not.exist');
    cy.get('.smart-activity-bar').should('be.visible');
    cy.get('.reader-feed-drawer').should('be.visible');
    cy.window().its('localStorage.ActivityBarCollapsed').should('equal', 'false');
  });

  it('keeps sidebar controls and list rows at 44px on a mobile viewport', () => {
    cy.viewport(375, 667);
    cy.get('button[aria-label="Toggle Sidebar"]').click();
    cy.get('.reader-feed-drawer').should('be.visible');
    ['toggle-pin', 'close-drawer', 'toggle-edit'].forEach((action) => {
      cy.get(`[data-action="${action}"]`).should(($button) => {
        const styles = window.getComputedStyle($button[0]);
        expect(styles.width).to.equal('44px');
        expect(styles.height).to.equal('44px');
      });
    });
    cy.get('.category-header').first().should('have.css', 'min-height', '44px');
    cy.get('.feed-item').first().should('have.css', 'min-height', '44px');
  });

  it('keeps controls touchable through the 640–767px mobile range', () => {
    cy.viewport(767, 800);
    cy.get('button[aria-label="Toggle Sidebar"]').click();
    cy.get('.reader-feed-drawer').should('be.visible');
    ['toggle-pin', 'close-drawer', 'toggle-edit'].forEach((action) => {
      cy.get(`[data-action="${action}"]`).should(($button) => {
        const styles = window.getComputedStyle($button[0]);
        expect(styles.width).to.equal('44px');
        expect(styles.height).to.equal('44px');
      });
    });
    cy.get('.category-toggle').should(($toggle) => {
      const styles = window.getComputedStyle($toggle[0]);
      expect(styles.width).to.equal('44px');
      expect(styles.height).to.equal('44px');
    });
    cy.get('button[aria-label="Collapse Activity Bar"]').click();
    cy.get('.edge-toggle-button').should(($button) => {
      const styles = window.getComputedStyle($button[0]);
      expect(styles.width).to.equal('44px');
      expect(styles.height).to.equal('800px');
    });
  });
});
