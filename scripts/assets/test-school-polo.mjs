import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url);
function glb(path) {
  const b = fs.readFileSync(new URL(path, root));
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  return { bytes: b.length, json: JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) };
}
const canonical = glb('public/models/avatars/male/body.glb').json;
const names = canonical.skins[0].joints.map(i => canonical.nodes[i].name).sort();
for (const gender of ['male', 'female']) {
  const {bytes,json:g} = glb(`public/models/avatars/${gender}/top-school-polo.glb`);
  assert.ok(bytes <= 1048576, `${gender}: budget`);
  assert.equal(g.animations?.length ?? 0, 0, 'wearables must have no animations');
  assert.equal(g.cameras?.length ?? 0, 0);
  assert.equal(g.extensions?.KHR_lights_punctual?.lights?.length ?? 0, 0);
  assert.ok(g.skins?.length > 0);
  for (const skin of g.skins) assert.deepEqual(skin.joints.map(i=>g.nodes[i].name).sort(), names);
  for (const node of g.nodes.filter(n=>n.mesh!==undefined)) {
    assert.match(node.name, /^Polo_/);
    assert.ok(node.skin !== undefined, 'every garment mesh must be skinned');
  }
  assert.ok(g.materials.some(m=>m.name==='AvatarTopTint'));
  for (const m of g.materials) assert.match(m.name,/^Avatar(TopTint|Detail)$/);
  console.log(`PASS ${gender}: ${bytes} bytes, canonical34, garment only, zero clips`);
}
