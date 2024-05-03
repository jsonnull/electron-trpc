{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/a817fdac5fea62e89332ea223c0a5ea8b6443341.tar.gz") {} }:

with pkgs;

mkShell {
  buildInputs = [
    git
    nodejs_20
    xvfb-run
    electron_29
  ];

  PLAYWRIGHT_ELECTRON_PATH="${electron_29}/bin/electron";
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1;
}
