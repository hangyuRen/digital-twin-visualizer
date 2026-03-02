<script lang="ts">
    import {onMount, onDestroy, tick} from 'svelte';
    import CurrentCharter from '../Current/CurrentCharter.svelte';
    import { startWebRTC } from "../Video/WebRTCPlayer";
    import {isRobotConnected} from "../../stores";

    let toastMessage = "";
    let showToast = false;
    let isConnecting = false;

    export let chartA: any;
    export let chartB: any;

    // 管道参数
    let pipeDiameter: string = "";
    let pipeThickness: string = "";

    // 连接机械臂函数
    async function connectRobots() {
        isConnecting = true;
        try {
            const res = await fetch("http://localhost:8082/connect", {
                method: "POST"
            });
            const data = await res.json();
            toastMessage = data.message;
            let flag = data.status;
            if (flag === "success") {
                isRobotConnected.set(true);
            }
        } catch (err) {
            toastMessage = "连接失败: 无法访问后端服务器";
        } finally {
            isConnecting = false;
            showToast = true;
            setTimeout(() => showToast = false, 3000);
        }
    }

    let cam3Video;

    let overlayCanvas;
    let bbox = null;

    async function captureFrame() {
        // 1. 检查机械臂连接
        if (!$isRobotConnected) {
            toastMessage = "请先连接机械臂";
            showToast = true;
            setTimeout(() => showToast = false, 3000);
            return;
        }

        // 2. 检查参数完整性
        if (!pipeDiameter || !pipeThickness) {
            toastMessage = "请先输入管道直径和厚度参数";
            showToast = true;
            setTimeout(() => showToast = false, 3000);
            return;
        }
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
        try {
            const res = await fetch("http://localhost:8082/detect", {
                method: "POST",
                headers: {
                    "Content-Type": "image/jpeg",
                    "X-Pipe-Diameter": pipeDiameter,
                    "X-Pipe-Thickness": pipeThickness
                },
                body: blob
            });

            const data = await res.json();
            bbox = data.message;
            // drawBBox();

            let flag = data.status;
            if (flag === "fail") {
                toastMessage = "点云获取失败: " + data.message;
            } else {
                toastMessage = "点云获取中";
            }
        } catch (e) {
            toastMessage = "点云获取失败: 无法访问后端服务器";
        } finally {
            showToast = true;
            setTimeout(() => showToast = false, 3000);
        }
    }

    onMount(async () => {
            // 等待 Svelte 完成 DOM 渲染和可能的切换动画
            await tick();

            // 延迟 100ms 避开组件销毁的边缘触发
            setTimeout(() => {
                startWebRTC(cam3Video, "cam3");
            }, 300);
        });

</script>

{#if showToast}
    <div class="toast toast-top toast-center z-[100] min-w-[300px] px-4">
        <div class="alert {toastMessage.includes('失败') ? 'alert-error' : 'alert-success'} shadow-lg flex flex-row items-center justify-center whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="font-bold">{toastMessage}</span>
        </div>
    </div>
{/if}

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
        <div class="flex gap-4">
            <div class="flex-1 relative bg-black rounded-xl border-2 border-gray-700 overflow-hidden">
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

            <div class="w-32 flex flex-col gap-3 justify-center">
                <button
                        on:click={connectRobots}
                        class="btn btn-outline btn-info btn-sm h-12"
                        disabled={isConnecting}
                >
                    {#if isConnecting}
                        <span class="loading loading-spinner loading-xs"></span>
                        正在连接...
                    {:else if $isRobotConnected}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        已连接机械臂
                    {:else}
                        连接机械臂
                    {/if}
                </button>

                <div class="flex flex-col gap-1">
                    <div class="relative">
                        <input
                                type="number"
                                placeholder="管道直径"
                                bind:value={pipeDiameter}
                                class="input input-bordered input-xs w-full pr-7 { !pipeDiameter && showToast ? 'input-error' : '' }"
                        />
                        <span class="absolute right-2 top-1 text-[10px] opacity-50">mm</span>
                    </div>
                    <div class="relative">
                        <input
                                type="number"
                                placeholder="管道厚度"
                                bind:value={pipeThickness}
                                class="input input-bordered input-xs w-full pr-7 { !pipeThickness && showToast ? 'input-error' : '' }"
                        />
                        <span class="absolute right-2 top-1 text-[10px] opacity-50">mm</span>
                    </div>
                </div>

                <button
                        on:click={captureFrame}
                        class="btn btn-primary btn-sm h-12"
                >
                    点云获取
                </button>

                <button class="btn btn-accent btn-sm h-12">
                    一键焊接
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
