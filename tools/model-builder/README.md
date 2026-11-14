# Model builder

Builds a .glb for the editor's Import a model from a YAML file of simple
shapes: rounded boxes, cylinders, lathes, spheres, tori, rods and prisms, in
meters, with x to the right, y up and z toward the front. Parts and groups
are named with the tags `src/decoration/modelTags.ts` reads, so a lamp's
shade glows and a cabinet's doors swing with the device bound to the piece.

```bash
pip install numpy pyyaml matplotlib
python3 tools/model-builder/build_model.py tools/model-builder/examples/kommode.yaml -o out/
```

It writes the .glb, a preview of the model shut and open, off and on, and a
report of its size, triangles, parts and what they do, named as the editor
will name them. `pnpm dev` and `src/dev/models.html?glb=/out/kommode.glb`
draw it in the card with a made up device.

A part with `top: true` is named with the `[top]` tag, which makes its upper
face a top other pieces can stand on, like a table's. Give it to every board
of a shelf unit and each one can be stood on, the highest one first. The
report lists the tops it will have under `tops`.

A part or a group with `option: Stand` is named with the `[opt Stand]` tag,
and `option: Cover off` with `[opt Cover off]`. Each option is a switch in
the item panel that keeps or leaves out its parts, starting on unless it says
off, so one model covers a monitor with and without its stand or a speaker
with and without its cover. Without a part the model rests on what is left:
on the floor, against the wall or up to the ceiling. The report lists the
options, and the build writes a second preview, `<name>_preview_options.png`,
with every option the other way. `--options Stand=0` previews a set of your
own instead.
