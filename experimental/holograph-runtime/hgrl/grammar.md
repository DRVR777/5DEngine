# HGRL Grammar Draft

```text
world NAME { dimensions { KEY = VALUE } safety { default_mode = propose_only } }
node NAME { kind = KIND }
link FROM -> TO { meaning = VALUE }
adapter NAME { observes COMMAND emits KIND }
policy NAME { applies_to KIND when EXPR propose ACTION mode MODE }
view NAME { include [KIND...] output [FORMAT...] }
```
