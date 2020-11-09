import * as HME from 'h264-mp4-encoder';
import { canvasToBlob } from '../../mol-canvas3d/util';
import { AnimateAssemblyUnwind } from '../../mol-plugin-state/animation/built-in';
import { PluginContext } from '../../mol-plugin/context';

export class Mp4Encoder {

    createImagePass() {
        const pass = this.plugin.canvas3d!.getImagePass({
            transparentBackground: false,
            cameraHelper: { axes: { name: 'off', params: {} } },
            multiSample: { mode: 'on', sampleLevel: 4 }, // { mode: 'on', sampleLevel: 2 },
            postprocessing: this.plugin.canvas3d!.props.postprocessing
        });
        return pass;
    }

    sleep() {
        return new Promise(res => setTimeout(res, 16.6));
    }

    async generate() {
        // const w = 1024, h = 768;
        const w = 1920, h = 1080;

        const encoder = await HME.createH264MP4Encoder();
        encoder.width = w;
        encoder.height = h;
        encoder.frameRate = 30;
        encoder.initialize();

        console.log('creating image pass');
        const pass = this.createImagePass();

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const canvasCtx = canvas.getContext('2d')!;

        const loop = this.plugin.animationLoop;

        loop.stop();
        loop.resetTime(0);

        const durationMs = 3000;
        const fps = encoder.frameRate;

        await this.plugin.managers.animation.play(AnimateAssemblyUnwind, { durationInMs: 3000, playOnce: true, target: 'all' });

        const imageData: Uint8ClampedArray[] = [];
        const N = Math.ceil(durationMs / 1000 * fps);
        const dt = durationMs / (N - 1);
        console.log({ w, h });
        for (let i = 0; i < N; i++) {

            const t = i * dt;
            await loop.tick(t, true);

            const image = pass.getImageData(w, h);
            if (i === 0) canvasCtx.putImageData(image, 0, 0);

            imageData.push(image.data);
            console.log(`frame ${i + 1}/${N}`);
            // await this.sleep();
        }

        let ii = 0;
        for (const f of imageData) {
            encoder.addFrameRgba(f);
            console.log(`added ${++ii}/${N}`);
        }

        console.log('finalizing');
        encoder.finalize();
        console.log('finalized');
        const uint8Array = encoder.FS.readFile(encoder.outputFilename);
        console.log('encoded');
        encoder.delete();

        await this.plugin.managers.animation.stop();
        loop.start();

        return { movie: uint8Array, image: await canvasToBlob(canvas, 'png') };
    }

    constructor(private plugin: PluginContext) {
    }
}