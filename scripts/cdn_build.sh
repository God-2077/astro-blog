astro build && find dist -mindepth 1 \
  ! -path 'dist/_astro' ! -path 'dist/_astro/*' \
  ! -path 'dist/img' ! -path 'dist/img/*' \
  ! -path 'dist/fonts' ! -path 'dist/fonts/*' \
  ! -path 'dist/katex' ! -path 'dist/katex/*' \
  ! -path 'dist/pagefind' ! -path 'dist/pagefind/*' \
  -delete && echo -e "User-agent: *\nDisallow: /" > dist/robots.txt