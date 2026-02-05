<script lang="ts">
    import {onMount, onDestroy, tick} from 'svelte';
    import CurrentCharter from '../Current/CurrentCharter.svelte';
    import CurrentWSClient from '../../wsClient/CurrentWSClient';

    let chartA: any;
    let chartB: any;

    let currentWS: CurrentWSClient;

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
            }, 100);
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
        <iframe
            src="http://localhost:8889/cam3"
            class="bg-black rounded-xl border-2 border-gray-700 w-full h-full"
            allow="autoplay; fullscreen"
        ></iframe>
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
