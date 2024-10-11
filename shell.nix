{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/8e65989a9972ce1da033f445d2598683590dfb8a.tar.gz") {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.git
    pkgs.nodejs_20
    pkgs.nodePackages.pnpm
    pkgs.xvfb-run
    pkgs.electron_30
  ];

  PLAYWRIGHT_ELECTRON_PATH="${pkgs.electron_30}/bin/electron";
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1;
}
