// Run with ELECTRON_RUN_AS_NODE=1 using the packaged WallWave.exe.
const assert = require('node:assert/strict');
const path = require('node:path');
const {createRequire} = require('node:module');
const {pathToFileURL} = require('node:url');

(async () => {
  const root = path.resolve(process.argv[2] || 'dist/win-unpacked/resources/app.asar');
  const requireApp = createRequire(path.join(root, 'package.json'));
  const sharp = requireApp('sharp');
  const bytes = await sharp({create: {width: 32, height: 32, channels: 3, background: '#32698a'}}).jpeg().toBuffer();
  assert.equal((await sharp(bytes).metadata()).width, 32);
  const entry = requireApp.resolve('@huggingface/transformers').replace(/\.cjs$/, '.mjs');
  const {env, AutoProcessor, CLIPVisionModelWithProjection, RawImage} = await import(pathToFileURL(entry).href);
  if (process.argv[3]) {
    env.cacheDir = path.resolve(process.argv[3]);
    env.allowLocalModels = true;
    env.localModelPath = env.cacheDir;
    env.allowRemoteModels = false;
    const options = {local_files_only: true};
    const processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32', options);
    const model = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', {...options, dtype: 'q8', device: 'cpu', session_options: {intraOpNumThreads: 1, interOpNumThreads: 1}});
    try {
      const inputs = await processor(new RawImage(new Uint8Array(32 * 32 * 3).fill(120), 32, 32, 3));
      const output = await model(inputs);
      assert.equal(output.image_embeds.data.length, 512);
      assert.ok(Array.from(output.image_embeds.data).every(Number.isFinite));
    } finally {
      await model.dispose();
    }
    console.log('PASS: packaged quantized CLIP produces 512 finite features offline.');
  }
  console.log('PASS: packaged native image decoder and Node AI runtime load.');
})().catch(error => { console.error(error); process.exitCode = 1; });
