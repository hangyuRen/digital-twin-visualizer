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

    let pointSize = 2;
    const WELD_MARKER_SIZE = 8;

    // 可编辑的焊缝数据（包含坐标与 rx/ry/rz）
    let weldA: any[] = [];
    let weldB: any[] = [];
    // 点云原始数据（只读，用于拾取）
    let cloudA: any[] = [];
    let cloudB: any[] = [];

    // 每条机械臂对应的 three.js 对象引用
    let cloudObjA: THREE.Points | null = null;
    let cloudObjB: THREE.Points | null = null;
    let weldPointsA: THREE.Points | null = null;
    let weldPointsB: THREE.Points | null = null;
    let weldLineA: THREE.Line | null = null;
    let weldLineB: THREE.Line | null = null;

    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();
    let mouseDownX = 0;
    let mouseDownY = 0;

    let isSubmittingWeld = false;

    async function showPointCloud() {
        showPointViewer = true;

        await tick();

        initViewer();

        const res = await fetch("http://localhost:8082/weld");
        const data = await res.json();

        cloudA = Array.isArray(data.cloudA) ? data.cloudA : [];
        cloudB = Array.isArray(data.cloudB) ? data.cloudB : [];
        weldA = Array.isArray(data.weldA) ? data.weldA.map(cloneWeld) : [];
        weldB = Array.isArray(data.weldB) ? data.weldB.map(cloneWeld) : [];

        renderPointCloud();

        // 1. 存入 Store 保持持久化
        lastPointCloudData.set(data);

        // 2. 尝试更新（如果此时场景已存在）
        updateDynamicPointClouds(data);
    }

    function cloneWeld(p: any) {
        return {
            x: +p.x,
            y: +p.y,
            z: +p.z,
            rx: p.rx !== undefined ? +p.rx : 0,
            ry: p.ry !== undefined ? +p.ry : 0,
            rz: p.rz !== undefined ? +p.rz : 0,
        };
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

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointerup", onPointerUp);

        animate();
    }

    // function renderPointCloud(cloudA, weldA, cloudB, weldB){

    //     if(cloudObj) scene.remove(cloudObj);
    //     if(weldLine) scene.remove(weldLine);

    //     // ========= A点云 =========

    //     const posA = new Float32Array(cloudA.length * 3);

    //     for(let i=0;i<cloudA.length;i++){

    //         posA[i*3]   = cloudA[i].x;
    //         posA[i*3+1] = cloudA[i].y;
    //         posA[i*3+2] = cloudA[i].z;

    //     }

    //     const geoA = new THREE.BufferGeometry();
    //     geoA.setAttribute(
    //         "position",
    //         new THREE.BufferAttribute(posA,3)
    //     );

    //     const matA = new THREE.PointsMaterial({
    //         size:pointSize,
    //         color:0xffffff
    //     });

    //     const cloudObjA = new THREE.Points(geoA,matA);
    //     scene.add(cloudObjA);


    //     // ========= B点云 =========

    //     const posB = new Float32Array(cloudB.length * 3);

    //     for(let i=0;i<cloudB.length;i++){

    //         posB[i*3]   = cloudB[i].x;
    //         posB[i*3+1] = cloudB[i].y;
    //         posB[i*3+2] = cloudB[i].z;

    //     }

    //     const geoB = new THREE.BufferGeometry();
    //     geoB.setAttribute(
    //         "position",
    //         new THREE.BufferAttribute(posB,3)
    //     );

    //     const matB = new THREE.PointsMaterial({
    //         size:pointSize,
    //         color:0x00aaff
    //     });

    //     const cloudObjB = new THREE.Points(geoB,matB);
    //     scene.add(cloudObjB);


    //     // ========= A焊缝 =========

    //     const weldPtsA = new Float32Array(weldA.length * 3);

    //     for(let i=0;i<weldA.length;i++){

    //         weldPtsA[i*3]   = weldA[i].x;
    //         weldPtsA[i*3+1] = weldA[i].y;
    //         weldPtsA[i*3+2] = weldA[i].z;

    //     }

    //     const weldGeoA = new THREE.BufferGeometry();

    //     weldGeoA.setAttribute(
    //         "position",
    //         new THREE.BufferAttribute(weldPtsA,3)
    //     );

    //     const weldLineA = new THREE.Line(
    //         weldGeoA,
    //         new THREE.LineBasicMaterial({color:0xff0000})
    //     );

    //     scene.add(weldLineA);


    //     // ========= B焊缝 =========

    //     const weldPtsB = new Float32Array(weldB.length * 3);

    //     for(let i=0;i<weldB.length;i++){

    //         weldPtsB[i*3]   = weldB[i].x;
    //         weldPtsB[i*3+1] = weldB[i].y;
    //         weldPtsB[i*3+2] = weldB[i].z;

    //     }

    //     const weldGeoB = new THREE.BufferGeometry();

    //     weldGeoB.setAttribute(
    //         "position",
    //         new THREE.BufferAttribute(weldPtsB,3)
    //     );

    //     const weldLineB = new THREE.Line(
    //         weldGeoB,
    //         new THREE.LineBasicMaterial({color:0x00ff00})
    //     );

    //     scene.add(weldLineB);


    //     // 自动居中
    //     autoCenter(posA);
    // }

    function renderPointCloud() {
        // --- 清理旧对象 ---
        [cloudObjA, cloudObjB, weldPointsA, weldPointsB, weldLineA, weldLineB]
            .forEach(obj => { if (obj) scene.remove(obj); });
        cloudObjA = cloudObjB = null;
        weldPointsA = weldPointsB = null;
        weldLineA = weldLineB = null;

        // --- 点云 ---
        cloudObjA = buildCloudPoints(cloudA, 0xffffff);
        if (cloudObjA) {
            cloudObjA.userData = { kind: "cloud", arm: "A" };
            scene.add(cloudObjA);
        }
        cloudObjB = buildCloudPoints(cloudB, 0x00aaff);
        if (cloudObjB) {
            cloudObjB.userData = { kind: "cloud", arm: "B" };
            scene.add(cloudObjB);
        }

        // --- 焊缝 ---
        rebuildWeld("A");
        rebuildWeld("B");

        // --- 自动居中 ---
        const centerSource = cloudA.length ? cloudA
            : cloudB.length ? cloudB
            : weldA.length ? weldA
            : weldB.length ? weldB
            : null;
        if (centerSource) autoCenter(centerSource);
    }

    function buildCloudPoints(pts: any[], color: number): THREE.Points | null {
        if (!pts || pts.length === 0) return null;
        const pos = new Float32Array(pts.length * 3);
        pts.forEach((p, i) => {
            pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ size: pointSize, color });
        return new THREE.Points(geo, mat);
    }

    function rebuildWeld(arm: "A" | "B") {
        const welds = arm === "A" ? weldA : weldB;
        const prevPoints = arm === "A" ? weldPointsA : weldPointsB;
        const prevLine = arm === "A" ? weldLineA : weldLineB;
        const pointColor = arm === "A" ? 0xff3030 : 0x30ff30;
        const lineColor = arm === "A" ? 0xff0000 : 0x00ff00;

        if (prevPoints) scene.remove(prevPoints);
        if (prevLine) scene.remove(prevLine);

        if (!welds.length) {
            if (arm === "A") { weldPointsA = null; weldLineA = null; }
            else { weldPointsB = null; weldLineB = null; }
            return;
        }

        const pos = new Float32Array(welds.length * 3);
        welds.forEach((p, i) => {
            pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

        const pointsMat = new THREE.PointsMaterial({ size: WELD_MARKER_SIZE, color: pointColor });
        const points = new THREE.Points(geo, pointsMat);
        points.userData = { kind: "weld", arm };

        const line = new THREE.Line(
            geo,
            new THREE.LineBasicMaterial({ color: lineColor })
        );

        scene.add(line);
        scene.add(points);

        if (arm === "A") { weldPointsA = points; weldLineA = line; }
        else { weldPointsB = points; weldLineB = line; }
    }

    function onPointerDown(event: PointerEvent) {
        mouseDownX = event.clientX;
        mouseDownY = event.clientY;
    }

    function onPointerUp(event: PointerEvent) {
        if (event.button !== 0) return;
        // 区分拖拽与点击：位移 > 5px 视为拖拽，不触发编辑
        if (Math.hypot(event.clientX - mouseDownX, event.clientY - mouseDownY) > 5) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouseNDC, camera);
        // 拾取阈值按当前点大小换算
        raycaster.params.Points.threshold = WELD_MARKER_SIZE;

        // 1. 先判断是否命中焊接点 -> 删除
        const weldTargets = [weldPointsA, weldPointsB].filter(Boolean) as THREE.Points[];
        const weldHits = raycaster.intersectObjects(weldTargets, false);
        if (weldHits.length > 0) {
            const hit = weldHits[0];
            const arm = (hit.object.userData as any).arm as "A" | "B";
            const idx = hit.index ?? -1;
            if (idx >= 0) {
                if (arm === "A") weldA = weldA.filter((_, i) => i !== idx);
                else weldB = weldB.filter((_, i) => i !== idx);
                rebuildWeld(arm);
            }
            return;
        }

        // 2. 否则判断是否命中点云 -> 新增焊接点（取最近点）
        raycaster.params.Points.threshold = Math.max(pointSize * 2, 3);
        const cloudTargets = [cloudObjA, cloudObjB].filter(Boolean) as THREE.Points[];
        const cloudHits = raycaster.intersectObjects(cloudTargets, false);
        if (cloudHits.length === 0) return;

        // 选取距离鼠标射线最近的命中点
        cloudHits.sort((a, b) => a.distanceToRay! - b.distanceToRay!);
        const hit = cloudHits[0];
        const arm = (hit.object.userData as any).arm as "A" | "B";
        const idx = hit.index ?? -1;
        if (idx < 0) return;

        const sourceCloud = arm === "A" ? cloudA : cloudB;
        const cp = sourceCloud[idx];
        if (!cp) return;

        const welds = arm === "A" ? weldA : weldB;
        const orientation = nearestWeldOrientation(welds, cp);
        const newPoint = {
            x: +cp.x, y: +cp.y, z: +cp.z,
            rx: orientation.rx, ry: orientation.ry, rz: orientation.rz,
        };

        // 插入到最近邻焊接点之后，保持焊缝顺序
        const insertIdx = orientation.nearestIdx >= 0 ? orientation.nearestIdx + 1 : welds.length;
        const next = [...welds.slice(0, insertIdx), newPoint, ...welds.slice(insertIdx)];
        if (arm === "A") weldA = next; else weldB = next;
        rebuildWeld(arm);
    }

    function nearestWeldOrientation(welds: any[], target: any) {
        if (!welds.length) return { rx: 0, ry: 0, rz: 0, nearestIdx: -1 };
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < welds.length; i++) {
            const dx = welds[i].x - target.x;
            const dy = welds[i].y - target.y;
            const dz = welds[i].z - target.z;
            const d = dx*dx + dy*dy + dz*dz;
            if (d < bestDist) { bestDist = d; best = i; }
        }
        const w = welds[best];
        return { rx: +w.rx || 0, ry: +w.ry || 0, rz: +w.rz || 0, nearestIdx: best };
    }

    function autoCenter(data) {
        // 1. 防御性编程：检查数据是否存在
        if (!data || data.length === 0) return;

        const box = new THREE.Box3();

        // 2. 注意：这里的 data 是后端传回的原始对象数组，不是 Float32Array
        // 所以不能用 for(i*3)，必须用 forEach 遍历对象
        data.forEach(point => {
            // 3. 确保 point 存在且有 x, y, z 属性
            if (point && point.x !== undefined) {
            box.expandByPoint(new THREE.Vector3(point.x, point.y, point.z));
            }
        });

        // 4. 如果数据全是无效点，box 会是空的，getCenter 会报错
        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);

        // 5. 关键：调整相机距离
        // 你的数据 Z 值很小（约6），但相机在 Z=800
        // 我们需要把相机拉近一点，或者强制更新 controls
        camera.position.set(center.x, center.y, center.z + 500); // 拉近到物体前方500单位
        controls.update();
    }

    function updatePointSize(){
        [cloudObjA, cloudObjB].forEach(obj => {
            if (obj) {
                (obj.material as THREE.PointsMaterial).size = pointSize;
                (obj.material as THREE.PointsMaterial).needsUpdate = true;
            }
        });
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
    let pipeDiameter: string = "300";
    let pipeThickness: string = "5";
    let current: string = "140";
    let voltage: string = "20";
    let speed: string = "4";
    let frequency: string = "2.0";
    let vibrateFrequency: string = "7";
    let stayTime: string = "0.2";

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

    // 手动获取点云：截取视频帧 + 可缩放/拖拽/标记像素的小窗
    let showManualCapture = false;
    let manualCanvas: HTMLCanvasElement;
    let capturedImage: HTMLImageElement | null = null;
    let imgScale = 1;
    let imgOffsetX = 0;
    let imgOffsetY = 0;
    let selectedPixel: { x: number; y: number } | null = null;
    let isSubmittingManual = false;

    let manualIsDragging = false;
    let manualDragStartX = 0;
    let manualDragStartY = 0;
    let manualDragStartOffsetX = 0;
    let manualDragStartOffsetY = 0;

    async function captureFrame() {
        // 1. 检查机械臂连接
        if (!$isRobotConnected) {
            toastMessage = "请先连接机械臂";
            showToast = true;
            setTimeout(() => showToast = false, 3000);
            return;
        }

        // 2. 检查参数完整性
        if (!pipeDiameter || !pipeThickness || !current || !voltage || !speed) {
            toastMessage = "请完整输入工艺参数";
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

    async function manualCapture() {
        if (!cam3Video || !cam3Video.videoWidth) {
            toastMessage = "视频尚未就绪";
            showToast = true;
            setTimeout(() => showToast = false, 3000);
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = cam3Video.videoWidth;
        canvas.height = cam3Video.videoHeight;
        canvas.getContext("2d").drawImage(cam3Video, 0, 0);

        const img = new Image();
        img.onload = async () => {
            capturedImage = img;
            selectedPixel = null;
            showManualCapture = true;
            await tick();
            resetManualView();
            drawManualCanvas();
        };
        img.src = canvas.toDataURL("image/jpeg", 0.9);
    }

    function resetManualView() {
        if (!capturedImage || !manualCanvas) return;
        const cw = manualCanvas.clientWidth;
        const ch = manualCanvas.clientHeight;
        manualCanvas.width = cw;
        manualCanvas.height = ch;
        const fit = Math.min(cw / capturedImage.width, ch / capturedImage.height);
        imgScale = fit;
        imgOffsetX = (cw - capturedImage.width * fit) / 2;
        imgOffsetY = (ch - capturedImage.height * fit) / 2;
    }

    function drawManualCanvas() {
        if (!manualCanvas || !capturedImage) return;
        const ctx = manualCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, manualCanvas.width, manualCanvas.height);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, manualCanvas.width, manualCanvas.height);
        ctx.drawImage(
            capturedImage,
            imgOffsetX,
            imgOffsetY,
            capturedImage.width * imgScale,
            capturedImage.height * imgScale
        );

        if (selectedPixel) {
            const sx = imgOffsetX + selectedPixel.x * imgScale;
            const sy = imgOffsetY + selectedPixel.y * imgScale;
            ctx.strokeStyle = "red";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - 12, sy);
            ctx.lineTo(sx + 12, sy);
            ctx.moveTo(sx, sy - 12);
            ctx.lineTo(sx, sy + 12);
            ctx.stroke();

            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    function onManualWheel(e: WheelEvent) {
        if (!capturedImage) return;
        e.preventDefault();
        const rect = manualCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newScale = Math.max(0.05, Math.min(40, imgScale * factor));
        // 以光标位置为锚缩放
        imgOffsetX = mx - (mx - imgOffsetX) * (newScale / imgScale);
        imgOffsetY = my - (my - imgOffsetY) * (newScale / imgScale);
        imgScale = newScale;
        drawManualCanvas();
    }

    function onManualPointerDown(e: PointerEvent) {
        if (e.button !== 0 || !capturedImage) return;
        manualIsDragging = false;
        manualDragStartX = e.clientX;
        manualDragStartY = e.clientY;
        manualDragStartOffsetX = imgOffsetX;
        manualDragStartOffsetY = imgOffsetY;
        manualCanvas.setPointerCapture(e.pointerId);
    }

    function onManualPointerMove(e: PointerEvent) {
        if (e.buttons !== 1 || !capturedImage) return;
        const dx = e.clientX - manualDragStartX;
        const dy = e.clientY - manualDragStartY;
        if (!manualIsDragging && Math.hypot(dx, dy) > 5) {
            manualIsDragging = true;
        }
        if (manualIsDragging) {
            imgOffsetX = manualDragStartOffsetX + dx;
            imgOffsetY = manualDragStartOffsetY + dy;
            drawManualCanvas();
        }
    }

    function onManualPointerUp(e: PointerEvent) {
        if (e.button !== 0 || !capturedImage) return;
        try { manualCanvas.releasePointerCapture(e.pointerId); } catch {}
        if (manualIsDragging) {
            manualIsDragging = false;
            return;
        }
        // 单击选点：屏幕坐标 -> 图像像素坐标
        const rect = manualCanvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const px = Math.round((cx - imgOffsetX) / imgScale);
        const py = Math.round((cy - imgOffsetY) / imgScale);
        if (px < 0 || py < 0 || px >= capturedImage.width || py >= capturedImage.height) return;
        selectedPixel = { x: px, y: py };
        drawManualCanvas();
    }

    async function confirmManualPixel() {
        if (!selectedPixel) {
            toastMessage = "请先在图像中点击选择一个像素点";
            showToast = true;
            setTimeout(() => showToast = false, 3000);
            return;
        }

        if (!cam3Video || !cam3Video.videoWidth) {
            toastMessage = "视频尚未就绪";
            showToast = true;
            setTimeout(() => showToast = false, 3000);
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = cam3Video.videoWidth;
        canvas.height = cam3Video.videoHeight;
        canvas.getContext("2d").drawImage(cam3Video, 0, 0);

        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, "image/jpeg", 0.9)
        );

        if (!blob) {
            toastMessage = "截图失败";
            showToast = true;
            setTimeout(() => showToast = false, 3000);
            return;
        }

        isSubmittingManual = true;
        try {
            const res = await fetch("http://localhost:8082/detect/manual", {
                method: "POST",
                headers: {
                    "Content-Type": "image/jpeg",
                    "X-Pipe-Diameter": pipeDiameter,
                    "X-Pipe-Thickness": pipeThickness,
                    "X-Pixel-X": String(selectedPixel.x),
                    "X-Pixel-Y": String(selectedPixel.y),
                },
                body: blob,
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.status !== "fail") {
                toastMessage = "像素坐标已发送" + (data.message ? ": " + data.message : "");
                showManualCapture = false;
            } else {
                toastMessage = "发送失败" + (data.message ? ": " + data.message : "");
            }
        } catch (e) {
            toastMessage = "发送失败: 无法访问后端服务器";
        } finally {
            isSubmittingManual = false;
            showToast = true;
            setTimeout(() => showToast = false, 3000);
        }
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
                    "X-Pipe-Thickness": pipeThickness,
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
                method: "GET",
                headers: {
                    "X-Current": current,
                    "X-Voltage": voltage,
                    "X-Speed": speed,
                    "X-Frequency": frequency,
                    "X-Vibrate-Frequency": vibrateFrequency,
                    "X-Stay-Time": stayTime
                }
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

    async function confirmWeldEdits() {
        isSubmittingWeld = true;
        try {
            const res = await fetch("http://localhost:8082/weld/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ weldA, weldB }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.status !== "fail") {
                toastMessage = "焊接点已更新" + (data.message ? ": " + data.message : "");
                // 同步回持久化 store，避免刷新后丢失手工修改
                const prev = ($lastPointCloudData as any) || {};
                lastPointCloudData.set({ ...prev, weldA, weldB });
                updateDynamicPointClouds({ ...prev, cloudA, cloudB, weldA, weldB });
            } else {
                toastMessage = "焊接点更新失败" + (data.message ? ": " + data.message : "");
            }
        } catch (e) {
            toastMessage = "焊接点更新失败: 无法访问后端服务器";
        } finally {
            isSubmittingWeld = false;
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

<div class="fixed top-4 right-4 z-[100]">
    <button
            on:click={connectRobots}
            class="btn btn-outline btn-info shadow-lg"
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
</div>

<div class="flex flex-col h-screen bg-base-300 p-3 md:p-4 gap-3 md:gap-4 overflow-hidden">
    <h2 class="text-xl md:text-2xl font-bold text-center flex-none">焊接机器人监控面板</h2>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-4 flex-[5] min-h-0 overflow-y-auto xl:overflow-visible">
        <!-- 海康摄像头1 -->
        <iframe
            src="http://localhost:8889/cam1"
            class="bg-black rounded-xl border-2 border-gray-700 w-full min-h-[220px] xl:min-h-0 h-full"
            allow="autoplay; fullscreen"
        ></iframe>

        <!-- 海康摄像头2 -->
        <iframe
            src="http://localhost:8889/cam2"
            class="bg-black rounded-xl border-2 border-gray-700 w-full min-h-[220px] xl:min-h-0 h-full"
            allow="autoplay; fullscreen"
        ></iframe>

        <div class="flex gap-3 md:gap-4 min-w-0 min-h-[220px] xl:min-h-0 h-full">
            <div class="flex-1 relative bg-black rounded-xl border-2 border-gray-700 overflow-hidden min-w-0">
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

            <div class="w-40 flex flex-col gap-2 shrink-0 overflow-y-auto pr-1">
                <div class="flex flex-col gap-1 bg-base-200 p-2 rounded-lg border border-base-100 shrink-0">
                    <span class="text-[10px] font-bold opacity-70 text-center">工艺/管道参数</span>

                    <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">直径(mm)</span>
                            <input type="number" bind:value={pipeDiameter} class="input input-bordered input-xs w-full" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">厚度(mm)</span>
                            <input type="number" bind:value={pipeThickness} class="input input-bordered input-xs w-full" />
                        </div>

                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">电流(A)</span>
                            <input type="number" bind:value={current} class="input input-bordered input-xs w-full" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">电压(V)</span>
                            <input type="number" bind:value={voltage} class="input input-bordered input-xs w-full" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">速度(m/h)</span>
                            <input type="number" bind:value={speed} class="input input-bordered input-xs w-full" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">频率(Hz)</span>
                            <input type="number" bind:value={frequency} class="input input-bordered input-xs w-full" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">摆频(Hz)</span>
                            <input type="number" bind:value={vibrateFrequency} class="input input-bordered input-xs w-full" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] pl-1 opacity-60">停留(s)</span>
                            <input type="number" bind:value={stayTime} class="input input-bordered input-xs w-full" />
                        </div>
                    </div>
                </div>

                <button
                        on:click={captureFrame}
                        class="btn btn-primary btn-sm"
                >
                    自动获取点云
                </button>

                <button
                        on:click={manualCapture}
                        class="btn btn-primary btn-info btn-sm"
                >
                    手动获取点云
                </button>

                <button
                        class="btn btn-secondary btn-sm"
                        on:click={showPointCloud}
                >
                    点云及焊缝显示
                </button>

                <button
                    class="btn btn-accent btn-sm"
                    on:click={startWeld}>
                    一键焊接
                </button>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 flex-[4] min-h-0">
        <div class="card bg-base-100 shadow-xl overflow-hidden border border-base-content/10 min-h-0 h-full">
            <CurrentCharter bind:this={chartA} armName="焊接机械臂A" />
        </div>
        <div class="card bg-base-100 shadow-xl overflow-hidden border border-base-content/10 min-h-0 h-full">
            <CurrentCharter bind:this={chartB} armName="焊接机械臂B" />
        </div>
    </div>
</div>

{#if showPointViewer}

    <div class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200]">

        <div class="bg-base-100 rounded-xl shadow-xl w-[1100px] h-[700px] relative flex flex-col">

            <div class="flex justify-between items-center p-3 border-b">

                <div class="flex items-center gap-3">
                    <span class="font-bold">点云与焊缝显示</span>
                    <span class="text-xs opacity-70">点击焊接点删除 / 点击点云新增</span>
                    <span class="text-xs badge badge-outline">A: {weldA.length}</span>
                    <span class="text-xs badge badge-outline">B: {weldB.length}</span>
                </div>

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
                            class="btn btn-sm btn-success"
                            on:click={confirmWeldEdits}
                            disabled={isSubmittingWeld}
                    >
                        {#if isSubmittingWeld}
                            <span class="loading loading-spinner loading-xs"></span>
                            提交中
                        {:else}
                            确认
                        {/if}
                    </button>

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

{#if showManualCapture}

    <div class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200]">

        <div class="bg-base-100 rounded-xl shadow-xl w-[1000px] h-[700px] relative flex flex-col">

            <div class="flex justify-between items-center p-3 border-b">

                <div class="flex items-center gap-3">
                    <span class="font-bold">手动获取点云</span>
                    <span class="text-xs opacity-70">滚轮缩放 · 左键拖拽 · 单击选点</span>
                    {#if selectedPixel}
                        <span class="text-xs badge badge-error">
                            像素: ({selectedPixel.x}, {selectedPixel.y})
                        </span>
                    {:else}
                        <span class="text-xs badge badge-outline">未选择像素点</span>
                    {/if}
                </div>

                <div class="flex items-center gap-3">

                    <button
                            class="btn btn-sm btn-ghost"
                            on:click={() => { resetManualView(); drawManualCanvas(); }}
                    >
                        重置视图
                    </button>

                    <button
                            class="btn btn-sm btn-success"
                            on:click={confirmManualPixel}
                            disabled={isSubmittingManual || !selectedPixel}
                    >
                        {#if isSubmittingManual}
                            <span class="loading loading-spinner loading-xs"></span>
                            提交中
                        {:else}
                            确认
                        {/if}
                    </button>

                    <button
                            class="btn btn-sm btn-error"
                            on:click={() => showManualCapture = false}
                    >
                        关闭
                    </button>

                </div>

            </div>

            <div class="flex-1 bg-black overflow-hidden">
                <canvas
                        bind:this={manualCanvas}
                        class="w-full h-full block cursor-crosshair touch-none select-none"
                        on:wheel={onManualWheel}
                        on:pointerdown={onManualPointerDown}
                        on:pointermove={onManualPointerMove}
                        on:pointerup={onManualPointerUp}
                ></canvas>
            </div>

        </div>

    </div>

{/if}
