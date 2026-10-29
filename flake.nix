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

            # Playwright only drives Electron, it never needs its own browsers.
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 1;
          };
      }
    );
}
