# Mobile Camera Viewport Rules

1. To avoid unwanted pinch-zooming of the web page during camera interactions, set `maximumScale: 1, userScalable: false` on Next.js `Viewport` configuration in `app/layout.tsx`.
2. Handle multi-touch pinch gestures explicitly with `touchstart`, `touchmove`, and `touchend` event listeners (`{ passive: false }` and `e.preventDefault()`) on the viewfinder element to drive camera track hardware zoom or digital zoom.
