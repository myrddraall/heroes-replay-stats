# TextField
Single-line input: film, hairline, hrs-text value, hrs-text-dim placeholder. Hover strong border; focus strong border + selected glow (the focus ring is the glow; keyboard focus adds the hrs-focus outline). `is-invalid` paints the border hrs-error and the help line below in hrs-error, always with words.
A `label` above when the field needs a name. Height `--hrs-control`.
**Material:** `mat-form-field` outlined via `mat.form-field-overrides`: outline hrs-border, focus outline hrs-border-strong, shape 0, container transparent, label `label` style.
