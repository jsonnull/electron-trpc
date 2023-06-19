{ pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/7cc23a097dde208c748bc764a365d347e99bccec.tar.gz") {} }:

with pkgs;

mkShell {
  buildInputs = [
    git
  ];

  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1;
}
