package update

import (
	"net/url"
	"strings"
)

const githubRepository = "tanzv/MrRSS"

const githubRepositoryURL = "https://github.com/" + githubRepository

const githubReleasesAPIURL = "https://api.github.com/repos/" + githubRepository + "/releases"

const githubReleasesLatestURL = githubRepositoryURL + "/releases/latest"

const githubReleaseAssetURLPrefix = githubRepositoryURL + "/releases/download/"

const githubReleaseAssetPathPrefix = "/" + githubRepository + "/releases/download/"

func isOfficialReleaseAssetURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host != "github.com" || parsed.User != nil {
		return false
	}

	if !strings.HasPrefix(parsed.Path, githubReleaseAssetPathPrefix) {
		return false
	}

	segments := strings.Split(strings.TrimPrefix(parsed.Path, githubReleaseAssetPathPrefix), "/")
	// GitHub release downloads use /releases/download/<tag>/<asset>. A tag can
	// contain slashes, so require at least the tag and asset segments rather
	// than an exact segment count.
	if len(segments) < 2 {
		return false
	}

	for _, segment := range segments {
		if !isSafeReleaseAssetPathSegment(segment) {
			return false
		}
	}

	return true
}

func isSafeReleaseAssetPathSegment(segment string) bool {
	for {
		if segment == "" || segment == "." || segment == ".." || strings.ContainsAny(segment, "/\\") {
			return false
		}

		decoded, err := url.PathUnescape(segment)
		if err != nil || decoded == segment {
			return true
		}

		segment = decoded
	}
}
