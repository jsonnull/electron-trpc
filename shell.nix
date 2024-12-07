{ pkgs ? import (fetchTarball
  "https://github.com/NixOS/nixpkgs/archive/8e65989a9972ce1da033f445d2598683590dfb8a.tar.gz")
  { } }:

let
  nodejs = pkgs.nodejs_20;
  electron = pkgs.electron_30;
  pnpm = pkgs.nodePackages.pnpm.overrideAttrs (oldAttrs: rec {
      version = "9.15.0";
      src = pkgs.fetchurl {
        url = "https://registry.npmjs.org/pnpm/-/pnpm-${version}.tgz";
      sha512 = 
          "sha512-duI3l2CkMo7EQVgVvNZije5yevN3mqpMkU45RBVsQpmSGon5djge4QfUHxLPpLZmgcqccY8GaPoIMe1MbYulbA==";
      };
  });
in pkgs.mkShell {
  buildInputs = [
    nodejs
    electron
    pkgs.git
    pkgs.xvfb-run
    pnpm
  ];

  PLAYWRIGHT_ELECTRON_PATH = "${electron}/bin/electron";
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 1;
}
