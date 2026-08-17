# LiteEdit Design System

LiteEdit uses a soft technical visual system. It keeps the structure needed for a precise editing tool, but avoids the hard red-and-black treatment of a strict brutalist interface.

## Palette

The interface uses a dark, low-glare neutral base and four accents:

| Token             | Value     | Use                                                     |
| ----------------- | --------- | ------------------------------------------------------- |
| `--accent-mint`   | `#70FFD2` | Primary actions, active tools, and healthy local status |
| `--accent-lemon`  | `#FFFC8C` | Focus rings, selected values, and keyboard emphasis     |
| `--accent-gold`   | `#FFCC4D` | Labels, counts, and secondary emphasis                  |
| `--accent-orange` | `#FF9137` | Warnings and destructive actions                        |

Use the accent colors as signals, not decoration. Do not use all four accents in one control group unless the colors represent different states.

## Shape and depth

- Use 6 px radii for controls and fields.
- Use 10 px radii for cards and 14 px radii for dialogs and empty states.
- Use 1 px separators with low-contrast neutral colors.
- Use a soft shadow only for elevated cards, dialogs, and transient status messages.
- Do not use gradients, glass effects, or hard offset shadows.
- Keep the canvas grid deterministic and low contrast. Do not draw decorative overlays over image content.

## Type and labels

- Use IBM Plex Mono for controls, measurements, shortcuts, and status text.
- Use the system sans-serif display stack for the `LiteEdit` wordmark and major headings.
- Keep command labels and status codes uppercase when this improves scanning.
- Render the product name as `LiteEdit`, with normal title casing.

## Interaction

- Keep keyboard focus visible with the lemon accent.
- Use mint for the active tool and the local-ready state.
- Preserve the existing no-upload boundary. Visual styling must not introduce external fonts, images, or service requests.
- Keep motion restrained and functional. Respect `prefers-reduced-motion`.
