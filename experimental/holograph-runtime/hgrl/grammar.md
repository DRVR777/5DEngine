# HGRL Grammar Draft

```text
document       = block*
block          = world | adapter | policy | view | manifest
world          = "world" string "{" section* "}"
section        = dimensions | safety | nodes | links
dimensions     = "dimensions" "{" assignment* "}"
safety         = "safety" "{" assignment* "}"
adapter        = "adapter" string "{" assignment* "}"
policy         = "policy" string "{" assignment* "}"
view           = "view" string "{" assignment* "}"
assignment     = identifier "=" value
value          = string | number | bool | list | object
```

The current prototype includes a small manifest reader and treats HGRL examples
as portable design fixtures.
