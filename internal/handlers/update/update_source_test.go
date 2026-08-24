package update

import "testing"

func TestIsOfficialReleaseAssetURLAcceptsOnlyCurrentRepositoryAssets(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  bool
	}{
		{
			name:  "current release asset",
			value: "https://github.com/tanzv/MrRSS/releases/download/v1.3.26/MrRSS-1.3.26-darwin-universal.dmg",
			want:  true,
		},
		{
			name:  "previous repository",
			value: "https://github.com/DevXDojo/MrRSS/releases/download/v1/app.zip",
			want:  false,
		},
		{
			name:  "lookalike host",
			value: "https://github.com.tanzv.example/MrRSS/releases/download/v1/app.zip",
			want:  false,
		},
		{
			name:  "wrong path",
			value: "https://github.com/tanzv/MrRSS/releases/latest",
			want:  false,
		},
		{
			name:  "missing release tag",
			value: "https://github.com/tanzv/MrRSS/releases/download/MrRSS.dmg",
			want:  false,
		},
		{
			name:  "missing asset name",
			value: "https://github.com/tanzv/MrRSS/releases/download/v1.3.26/",
			want:  false,
		},
		{
			name:  "literal traversal",
			value: "https://github.com/tanzv/MrRSS/releases/download/v1.3.26/../private.zip",
			want:  false,
		},
		{
			name:  "encoded traversal",
			value: "https://github.com/tanzv/MrRSS/releases/download/v1.3.26/%2e%2e/private.zip",
			want:  false,
		},
		{
			name:  "double encoded traversal",
			value: "https://github.com/tanzv/MrRSS/releases/download/v1.3.26/%252e%252e/private.zip",
			want:  false,
		},
		{
			name:  "userinfo is not allowed",
			value: "https://token@github.com/tanzv/MrRSS/releases/download/v1.3.26/MrRSS.dmg",
			want:  false,
		},
		{
			name:  "explicit port is not allowed",
			value: "https://github.com:443/tanzv/MrRSS/releases/download/v1.3.26/MrRSS.dmg",
			want:  false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isOfficialReleaseAssetURL(tc.value); got != tc.want {
				t.Fatalf("isOfficialReleaseAssetURL(%q) = %v, want %v", tc.value, got, tc.want)
			}
		})
	}
}
