# Assets

Drop real media here to replace placeholders in `index.html`:

- `hero-demo.mp4` (or `.gif`) — hero section, presenter screen vs. shared/recorded screen side by side or before/after.
- `feature-*.mp4` / `.png` — one clip or screenshot per feature row in `#features`.
- `og-image.png` — 1200x630 social preview image, referenced by the `og:image` meta tag.

Video markup pattern once a clip exists (replace a `.media-placeholder` block):

```html
<video
  class="demo-media"
  autoplay
  muted
  loop
  playsinline
  poster="assets/hero-poster.jpg"
>
  <source src="assets/hero-demo.mp4" type="video/mp4" />
</video>
```
