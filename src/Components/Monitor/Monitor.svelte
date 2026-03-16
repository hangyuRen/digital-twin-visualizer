<script lang="ts">
    import {onMount, onDestroy, tick} from 'svelte';
    import CurrentCharter from '../Current/CurrentCharter.svelte';
    import { startWebRTC } from "../Video/WebRTCPlayer";
    import {isRobotConnected, lastPointCloudData} from "../../stores";
    import * as THREE from "three";
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
    import { updateDynamicPointClouds } from '../Scene/createScene';

    // 点云显示相关
    let showPointViewer = false;
    let viewerDiv;

    let scene;
    let camera;
    let renderer;
    let controls;

    let cloudObj;
    let weldLine;

    let pointSize = 2;

    async function showPointCloud() {

        showPointViewer = true;

        await tick();

        initViewer();

        const res = await fetch("http://localhost:8082/weld");
        const data = await res.json();

        renderPointCloud(
            data.cloudA,
            data.weldA,
            data.cloudB,
            data.weldB
        );

        // 1. 存入 Store 保持持久化
        lastPointCloudData.set(data);

        // 2. 尝试更新（如果此时场景已存在）
        updateDynamicPointClouds(data);
    }

    function initViewer() {
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            60,
            viewerDiv.clientWidth / viewerDiv.clientHeight,
            0.1,
            100000
        );

        camera.position.set(0,0,800);

        renderer = new THREE.WebGLRenderer({antialias:true});
        renderer.setSize(viewerDiv.clientWidth,viewerDiv.clientHeight);

        viewerDiv.innerHTML="";
        viewerDiv.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        const axes = new THREE.AxesHelper(200);
        scene.add(axes);

        animate();
    }

    function renderPointCloud(cloudA, weldA, cloudB, weldB){

        if(cloudObj) scene.remove(cloudObj);
        if(weldLine) scene.remove(weldLine);

        // ========= A点云 =========

        const posA = new Float32Array(cloudA.length * 3);

        for(let i=0;i<cloudA.length;i++){

            posA[i*3]   = cloudA[i].x;
            posA[i*3+1] = cloudA[i].y;
            posA[i*3+2] = cloudA[i].z;

        }

        const geoA = new THREE.BufferGeometry();
        geoA.setAttribute(
            "position",
            new THREE.BufferAttribute(posA,3)
        );

        const matA = new THREE.PointsMaterial({
            size:pointSize,
            color:0xffffff
        });

        const cloudObjA = new THREE.Points(geoA,matA);
        scene.add(cloudObjA);


        // ========= B点云 =========

        const posB = new Float32Array(cloudB.length * 3);

        for(let i=0;i<cloudB.length;i++){

            posB[i*3]   = cloudB[i].x;
            posB[i*3+1] = cloudB[i].y;
            posB[i*3+2] = cloudB[i].z;

        }

        const geoB = new THREE.BufferGeometry();
        geoB.setAttribute(
            "position",
            new THREE.BufferAttribute(posB,3)
        );

        const matB = new THREE.PointsMaterial({
            size:pointSize,
            color:0x00aaff
        });

        const cloudObjB = new THREE.Points(geoB,matB);
        scene.add(cloudObjB);


        // ========= A焊缝 =========

        const weldPtsA = new Float32Array(weldA.length * 3);

        for(let i=0;i<weldA.length;i++){

            weldPtsA[i*3]   = weldA[i].x;
            weldPtsA[i*3+1] = weldA[i].y;
            weldPtsA[i*3+2] = weldA[i].z;

        }

        const weldGeoA = new THREE.BufferGeometry();

        weldGeoA.setAttribute(
            "position",
            new THREE.BufferAttribute(weldPtsA,3)
        );

        const weldLineA = new THREE.Line(
            weldGeoA,
            new THREE.LineBasicMaterial({color:0xff0000})
        );

        scene.add(weldLineA);


        // ========= B焊缝 =========

        const weldPtsB = new Float32Array(weldB.length * 3);

        for(let i=0;i<weldB.length;i++){

            weldPtsB[i*3]   = weldB[i].x;
            weldPtsB[i*3+1] = weldB[i].y;
            weldPtsB[i*3+2] = weldB[i].z;

        }

        const weldGeoB = new THREE.BufferGeometry();

        weldGeoB.setAttribute(
            "position",
            new THREE.BufferAttribute(weldPtsB,3)
        );

        const weldLineB = new THREE.Line(
            weldGeoB,
            new THREE.LineBasicMaterial({color:0x00ff00})
        );

        scene.add(weldLineB);


        // 自动居中
        autoCenter(posA);
    }

    function autoCenter(points){
        const box = new THREE.Box3();

        for(let i=0;i<points.length;i+=3){

            box.expandByPoint(
                new THREE.Vector3(
                    points[i],
                    points[i+1],
                    points[i+2]
                )
            );

        }

        const center = box.getCenter(new THREE.Vector3());

        controls.target.copy(center);
        controls.update();
    }

    function updatePointSize(){

        if(cloudObj){

            cloudObj.material.size = pointSize;
            cloudObj.material.needsUpdate = true;

        }
    }

    function animate(){

        requestAnimationFrame(animate);

        if(controls) controls.update();

        if(renderer && scene && camera){
            renderer.render(scene, camera);
        }
    }

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

    async function startWeld() {
        try {
            const res = await fetch("http://localhost:8082/weld", {
                method: "GET"
            });

            const data = await res.json();

            if (data.status === "fail") {
                toastMessage = "焊接失败: " + data.message;
            } else {
                toastMessage = "焊接成功: " + data.message;
            }

        } catch (e) {
            toastMessage = "焊接失败: 无法访问后端服务器";
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

                <button
                        class="btn btn-secondary btn-sm h-12"
                        on:click={showPointCloud}
                >
                    点云及焊缝显示
                </button>

                <button
                    class="btn btn-accent btn-sm h-12"
                    on:click={startWeld}>
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

{#if showPointViewer}

    <div class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200]">

        <div class="bg-base-100 rounded-xl shadow-xl w-[1100px] h-[700px] relative flex flex-col">

            <div class="flex justify-between items-center p-3 border-b">

                <span class="font-bold">点云与焊缝显示</span>

                <div class="flex items-center gap-3">

                    <label class="text-sm">点大小</label>

                    <input
                            type="range"
                            min="1"
                            max="10"
                            bind:value={pointSize}
                            on:input={updatePointSize}
                    />

                    <button
                            class="btn btn-sm btn-error"
                            on:click={() => showPointViewer=false}
                    >
                        关闭
                    </button>

                </div>

            </div>

            <div
                    bind:this={viewerDiv}
                    class="flex-1"
            ></div>

        </div>

    </div>

{/if}
