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

      const expectedTokens = {
        paper: {
          '--surface-rail': 'rgb(238, 242, 246)',
          '--surface-panel': 'rgb(248, 250, 252)',
          '--text-secondary': 'rgb(71, 85, 105)',
          '--accent-text-color': 'rgb(29, 78, 216)',
        },
        ink: {
          '--surface-rail': 'rgb(17, 21, 26)',
          '--surface-panel': 'rgb(25, 30, 37)',
          '--text-secondary': 'rgb(186, 197, 209)',
          '--accent-text-color': 'rgb(141, 203, 255)',
        },
        sepia: {
          '--surface-rail': 'rgb(233, 224, 211)',
          '--surface-panel': 'rgb(247, 243, 236)',
          '--text-secondary': 'rgb(97, 87, 78)',
          '--accent-text-color': 'rgb(136, 63, 27)',
        },
        'high-contrast': {
          '--surface-rail': 'rgb(10, 10, 10)',
          '--surface-panel': 'rgb(0, 0, 0)',
          '--text-secondary': 'rgb(245, 245, 245)',
          '--accent-text-color': 'rgb(255, 230, 0)',
        },
      } as const;

      Object.entries(expectedTokens).forEach(([preset, tokens]) => {
        root.dataset.themePreset = preset;
        void active!.offsetWidth;
        const railColor = window.getComputedStyle(rail!).backgroundColor;
        expect(railColor).to.not.equal('rgba(0, 0, 0, 0)');
        expect(window.getComputedStyle(drawer!).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
        expect(window.getComputedStyle(active!).color).to.equal(
          resolveTokenColor('--accent-text-color')
        );
        Object.entries(tokens).forEach(([token, expected]) => {
          expect(resolveTokenColor(token)).to.equal(expected);
        });
      });

      root.dataset.themePreset = 'paper';
      const shadowBefore = window.getComputedStyle(drawer!).boxShadow;
      root.style.setProperty('--overlay-shadow-color', '#123456');
      const shadowAfter = window.getComputedStyle(drawer!).boxShadow;
      expect(shadowAfter).to.not.equal(shadowBefore);
    });
  });

  it('previews an auto-hidden desktop rail without a persistent edge button', () => {
    cy.viewport(1440, 900);
    cy.get('[aria-label="Auto-hide Activity Bar"]').click();
    cy.get('[data-testid="sidebar-edge-toggle"]').should('not.exist');
    cy.get('.sidebar-reveal-bridge').should('have.attr', 'aria-label', 'Show Activity Bar');
    cy.window().its('localStorage.ActivityBarCollapsed').should('equal', 'true');

    let collapsedDrawerLeft = 0;
    cy.get('.reader-feed-drawer')
      .should('be.visible')
      .then(($drawer) => {
        collapsedDrawerLeft = $drawer[0].getBoundingClientRect().left;
      });

    cy.get('.sidebar-toggle-container').trigger('pointerenter', { pointerType: 'mouse' });
    cy.get('.smart-activity-bar').should('be.visible');
    cy.get('[aria-label="Keep Activity Bar Visible"]').should('be.visible');
    cy.get('[aria-label="Auto-hide Activity Bar"]').should('not.exist');
    cy.get('.reader-feed-drawer').should(($drawer) => {
      expect($drawer[0].getBoundingClientRect().left).to.equal(collapsedDrawerLeft);
    });

    cy.get('.sidebar-toggle-container').trigger('pointerleave', { pointerType: 'mouse' });
    cy.wait(230);
    cy.get('.smart-activity-bar').should('not.exist');
    cy.window().its('localStorage.ActivityBarCollapsed').should('equal', 'true');

    cy.get('.sidebar-toggle-container').trigger('pointerenter', { pointerType: 'mouse' });
    cy.get('[aria-label="Keep Activity Bar Visible"]').click();
    cy.get('.sidebar-reveal-bridge').should('not.exist');
    cy.get('.smart-activity-bar').should('be.visible');
    cy.get('[aria-label="Auto-hide Activity Bar"]').should('be.visible');
    cy.get('.reader-feed-drawer').should('be.visible');
    cy.window().its('localStorage.ActivityBarCollapsed').should('equal', 'false');
  });

  it('keeps a pinned desktop drawer stationary while the edge preview opens', () => {
    cy.viewport(1440, 900);
    cy.window().then((window) => {
      window.localStorage.setItem('FeedListPinned', 'true');
      window.localStorage.setItem('FeedListExpanded', 'true');
      // Retain compatibility with the historical preference value on startup.
      window.localStorage.setItem('ActivityBarCollapsed', 'true');
    });
    cy.reload();

    cy.get('.reader-feed-drawer').should('have.class', 'is-pinned');
    cy.get('[data-testid="sidebar-edge-toggle"]').should('not.exist');
    cy.get('.sidebar-reveal-bridge').should('have.attr', 'aria-label', 'Show Activity Bar');

    let collapsedDrawerLeft = 0;
    cy.get('.reader-feed-drawer').then(($drawer) => {
      collapsedDrawerLeft = $drawer[0].getBoundingClientRect().left;
    });

    cy.get('.sidebar-toggle-container').trigger('pointerenter', { pointerType: 'mouse' });
    cy.get('[aria-label="Keep Activity Bar Visible"]').should('be.visible');
    cy.get('.reader-feed-drawer').then(($drawer) => {
      expect($drawer[0].getBoundingClientRect().left).to.equal(collapsedDrawerLeft);
    });
    cy.wait(100);
    cy.get('.reader-feed-drawer').then(($drawer) => {
      expect($drawer[0].getBoundingClientRect().left).to.equal(collapsedDrawerLeft);
    });
  });

  it('moves keyboard focus from the desktop reveal zone into the preview rail', () => {
    cy.viewport(1440, 900);
    cy.get('[aria-label="Auto-hide Activity Bar"]').click();

    cy.get('.sidebar-reveal-bridge').focus().type('{enter}');
    cy.get('[aria-label="Keep Activity Bar Visible"]').should('be.visible');
    cy.get('.smart-activity-bar button').first().should('have.focus');
  });

  it('returns keyboard focus to the desktop reveal zone after auto-hiding', () => {
    cy.viewport(1440, 900);

    cy.get('[aria-label="Auto-hide Activity Bar"]').focus().type('{enter}');
    cy.get('.sidebar-reveal-bridge').should('have.focus');
    cy.window().its('localStorage.ActivityBarCollapsed').should('equal', 'true');
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
    cy.get('.edge-pin-button')
      .should('have.attr', 'aria-label', 'Expand Activity Bar')
      .should('have.attr', 'aria-expanded', 'false')
      .should(($button) => {
        const styles = window.getComputedStyle($button[0]);
        expect(styles.width).to.equal('44px');
        expect(styles.height).to.equal('800px');
      });
    cy.get('.edge-pin-button').click();
    cy.get('.edge-pin-button').should('not.exist');
    cy.get('button[aria-label="Collapse Activity Bar"]').should('be.visible');
  });

  it('returns keyboard focus to mobile expansion after collapsing the rail', () => {
    cy.viewport(375, 667);
    cy.get('button[aria-label="Toggle Sidebar"]').click();
    cy.get('button[aria-label="Collapse Activity Bar"]').focus().type('{enter}');

    cy.get('.edge-pin-button')
      .should('have.focus')
      .should('have.attr', 'aria-label', 'Expand Activity Bar');
    cy.window().its('localStorage.ActivityBarCollapsed').should('equal', 'true');
  });

  it('interprets a saved collapsed rail as the mobile collapsed state on startup', () => {
    cy.viewport(375, 667);
    cy.window().then((window) => {
      window.localStorage.setItem('ActivityBarCollapsed', 'true');
      window.localStorage.setItem('FeedListExpanded', 'true');
    });
    cy.reload();

    cy.get('button[aria-label="Toggle Sidebar"]').click();
    cy.get('.edge-pin-button')
      .should('have.attr', 'aria-label', 'Expand Activity Bar')
      .should('have.attr', 'aria-expanded', 'false');
  });
});
