{
  description = "electron-trpc dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        requiredNodejs = pkgs.nodejs_24;
        # Prebuilt Electron from npm runs through nix-ld. It loads these libraries at runtime, with
        # the dynamic linker from the same nixpkgs so their glibc versions match.
        electronLibraries = with pkgs; [
          alsa-lib
          at-spi2-atk
          at-spi2-core
          atk
          cairo
          cups
          dbus
          expat
          glib
          gtk3
          libdrm
          libgbm
          libxkbcommon
          nspr
          nss
          pango
          systemd
          libx11
          libxcomposite
          libxdamage
          libxext
          libxfixes
          libxrandr
          libxcb
        ];
      in
      {
        devShells.default =
          assert pkgs.lib.versionAtLeast requiredNodejs.version "24.11.0";
          pkgs.mkShell {
            packages = with pkgs; [
              requiredNodejs
              pnpm_12
              git
              xvfb-run
            ];

            NIX_LD = pkgs.lib.fileContents "${pkgs.stdenv.cc}/nix-support/dynamic-linker";
            NIX_LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath electronLibraries;
            # Playwright only drives Electron, it never needs its own browsers.
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 1;
          };
      }
    );
}
