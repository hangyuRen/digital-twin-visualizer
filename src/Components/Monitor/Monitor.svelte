<script lang="ts">
    import {onMount, onDestroy, tick} from 'svelte';
    import CurrentCharter from '../Current/CurrentCharter.svelte';
    import CurrentWSClient from '../../wsClient/CurrentWSClient';
    import { startWebRTC } from "../Video/WebRTCPlayer";

    let chartA: any;
    let chartB: any;
    let currentWS: CurrentWSClient;


    let cam3Video;

let overlayCanvas;
let bbox = null;

async function captureFrame() {
    const canvas = document.createElement("canvas");
    canvas.width = cam3Video.videoWidth;
    canvas.height = cam3Video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(cam3Video, 0, 0);

    const blob = await new Promise(resolve =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
    );

    uploadFrame(blob);
}

function drawBBox() {
    if (!bbox) return;

    overlayCanvas.width = cam3Video.clientWidth;
    overlayCanvas.height = cam3Video.clientHeight;

    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const scaleX = overlayCanvas.width / cam3Video.videoWidth;
    const scaleY = overlayCanvas.height / cam3Video.videoHeight;

    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;

    ctx.strokeRect(
        bbox.x * scaleX,
        bbox.y * scaleY,
        bbox.w * scaleX,
        bbox.h * scaleY
    );
}

async function uploadFrame(blob) {
    const res = await fetch("http://172.15.8.26:8082/detect", {
        method: "POST",
        headers: {
            "Content-Type": "image/jpeg"
        },
        body: blob
    });

    const data = await res.json();
    bbox = data.bbox;
    drawBBox();
}

    onMount(async () => {
            // 等待 Svelte 完成 DOM 渲染和可能的切换动画
            await tick();

            // 延迟 100ms 避开组件销毁的边缘触发
            setTimeout(() => {
                if (currentWS) return; // 防止重复初始化

                currentWS = new CurrentWSClient('ws://127.0.0.1:8081', (armA, armB) => {
                    if (chartA) chartA.updateData(armA);
                    if (chartB) chartB.updateData(armB);
                });
                currentWS.start();

                startWebRTC(cam3Video, "cam3");
            }, 300);
        });

    onDestroy(() => {
            if (currentWS) {
                currentWS.stop();
                currentWS = null;
            }
        }
    );
</script>

<div class="flex flex-col h-screen bg-base-300 p-4 gap-4 overflow-hidden">
    <h2 class="text-2xl font-bold text-center flex-none">焊接机器人监控面板</h2>

    <div class="grid grid-cols-3 gap-4 h-[45%] flex-none">
        <!-- <div class="bg-black rounded-xl border-2 border-gray-700 flex items-center justify-center text-white">HK Camera 1</div>
        <div class="bg-black rounded-xl border-2 border-gray-700 flex items-center justify-center text-white">HK Camera 2</div> -->
        <!-- <div class="bg-black rounded-xl border-2 border-gray-700 flex items-center justify-center text-white">TP-Link Camera</div> -->
        <!-- 海康摄像头1 -->
        <iframe
            src="http://localhost:8889/cam1"
            class="bg-black rounded-xl border-2 border-gray-700 w-full h-full"
            allow="autoplay; fullscreen"
        ></iframe>

        <!-- 海康摄像头2 -->
        <iframe
            src="http://localhost:8889/cam2"
            class="bg-black rounded-xl border-2 border-gray-700 w-full h-full"
            allow="autoplay; fullscreen"
        ></iframe>

        <!-- TPLINK -->
        <!-- <iframe
            src="http://localhost:8889/cam3"
            class="bg-black rounded-xl border-2 border-gray-700 w-full h-full"
            allow="autoplay; fullscreen"
        ></iframe> -->
        <div class="flex bg-black rounded-xl border-2 border-gray-700 overflow-hidden">

            <!-- 左侧：TPLink视频 -->
            <div class="flex-1 relative">
                <video
                    bind:this={cam3Video}
                    autoplay
                    muted
                    playsinline
                    class="w-full h-full object-contain"
                ></video>
        
                <canvas
                    bind:this={overlayCanvas}
                    class="absolute inset-0 pointer-events-none"
                ></canvas>
            </div>
        
            <!-- 右侧：操作按钮面板 -->
            <div class="w-48 bg-base-200 flex flex-col gap-3 p-3 border-l">
        
                <button
                    on:click={captureFrame}
                    class="btn btn-primary"
                >
                    焊缝定位
                </button>
        
                <button class="btn btn-secondary">
                    xxxx
                </button>
        
                <button class="btn btn-accent">
                    xxxx
                </button>
        
                <button class="btn btn-outline">
                    xxxx
                </button>
        
            </div>
        
        </div>
    </div>

    <div class="grid grid-cols-2 gap-4 h-[45%] flex-none">
        <div class="card bg-base-100 shadow-xl overflow-hidden">
            <CurrentCharter bind:this={chartA} armName="焊接机械臂A" />
        </div>
        <div class="card bg-base-100 shadow-xl overflow-hidden">
            <CurrentCharter bind:this={chartB} armName="焊接机械臂B" />
        </div>
    </div>
</div>
