package media

import (
	"strings"
	"testing"
)

func TestRewriteHTMLContent_NavigatesArticleLinksInsideWebpageProxy(t *testing.T) {
	result := string(rewriteHTMLContent(
		[]byte(`<html><head></head><body><a href="next-page" target="_blank">Next</a></body></html>`),
		"https://example.com/articles/current",
	))

	const expectedHref = `href="/api/webpage/proxy?url=https%3A%2F%2Fexample.com%2Farticles%2Fnext-page"`
	if !strings.Contains(result, expectedHref) {
		t.Fatalf("expected proxied article link %q in %q", expectedHref, result)
	}
	if !strings.Contains(result, `target="_self"`) {
		t.Fatalf("expected rewritten link to stay in the iframe, got %q", result)
	}
	if strings.Contains(result, "BROWSER-OPEN:") || strings.Contains(result, "/api/browser/open") {
		t.Fatalf("expected webpage proxy content not to invoke the default browser, got %q", result)
	}
}
