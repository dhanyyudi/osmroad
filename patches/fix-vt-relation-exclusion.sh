#!/bin/bash
# Patch @osmix/vt to not exclude relation member ways from tile rendering.
# Without this patch, roads that are members of route/restriction/boundary
# relations are invisible on the map.
#
# This patch should be run after npm install (via postinstall script).

ENCODE_JS="node_modules/@osmix/vt/dist/encode.js"

if [ ! -f "$ENCODE_JS" ]; then
  echo "Skipping VT patch: $ENCODE_JS not found"
  exit 0
fi

# Remove relationWayIds from getTileForBbox
sed -i.bak \
  -e 's/const relationWayIds = this.osm.relations.getWayMemberIds();//' \
  -e 's/features: this.wayFeatures(bbox, proj, relationWayIds)/features: this.wayFeatures(bbox, proj)/' \
  "$ENCODE_JS"

# Remove relationWayIds parameter and skip logic from wayFeatures
sed -i.bak \
  -e 's/\*wayFeatures(bbox, proj, relationWayIds)/*wayFeatures(bbox, proj)/' \
  -e '/if (id !== undefined && relationWayIds?.has(id))/d' \
  -e '/\/\/ Skip ways that are part of relations/d' \
  "$ENCODE_JS"

rm -f "${ENCODE_JS}.bak"
echo "Patched @osmix/vt: relation member ways are now rendered individually"
