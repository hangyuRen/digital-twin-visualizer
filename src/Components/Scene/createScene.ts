import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  AmbientLight,
  PCFSoftShadowMap,
  Object3D,
  Box3,
  Vector3,
  MathUtils,
  LoadingManager,
} from 'three';

import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import URDFLoader, { URDFRobot } from 'urdf-loader';

import { jointInfosStore, selectedUpAxisStore } from '../../stores';
import type { JointInfo } from '../../types';
import getFileNameFromPath from './utils/getFileNameFromPath';
import scaleInView from './utils/scaleInView';
import { loadSTL, loadDAE } from './utils/loadMesh';
import setRobotRotation from './utils/setRobotRotation';
import * as axes from '../../constants/axes';
import { loadPointCloudA, loadPointCloudB, scale } from './loadPointCloud';

import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// 定义全局变量
let transformControls: TransformControls;
let baseFrameAnchor: THREE.Object3D;

const URDF_FILE_PATH = '../urdf/myRobot/urdf/robot.urdf';
const POINT_CLOUD_URLA = '../pointcloud/pointcloudA1769508415.txt';
const POINT_CLOUD_URLB = '../pointcloud/pointcloudB1769508415.txt';

/*

THREE.js
   Y
   |
   |
   .-----X
 ／
Z

ROS URDf
       Z
       |   X
       | ／
 Y-----.

*/

let scene: Scene;
let camera: PerspectiveCamera;
let renderer: WebGLRenderer;
let manager: LoadingManager;
let loader: URDFLoader;
let robot: URDFRobot;
let controls: OrbitControls;
let box: Box3;

function createScene(canvasEl: HTMLCanvasElement): void {
  init(canvasEl);
  render();
}

function init(canvasEl: HTMLCanvasElement): void {
  // *** Initialize three.js scene ***

  scene = new Scene();

  const fov = 45;
  const aspectRatio = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 100;
  camera = new PerspectiveCamera(fov, aspectRatio, near, far);
  camera.position.set(2, 2, 2);

  renderer = new WebGLRenderer({ antialias: true, canvas: canvasEl });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Lighting
  var lights = [];
  lights[0] = new THREE.PointLight(0x304ffe, 1, 0);
  lights[1] = new THREE.PointLight(0xffffff, 1, 0);
  lights[2] = new THREE.PointLight(0xffffff, 1, 0);
  lights[0].position.set(0, 200, 0);
  lights[1].position.set(100, 200, 100);
  lights[2].position.set(-100, -200, -100);
  scene.add(lights[0]);
  scene.add(lights[1]);
  scene.add(lights[2]);

  // Background
  scene.background = new THREE.Color(0x2A303C); //0x263238

  // Grid
  // const size = 100;
  // const divisions = 100;
  // const gridHelper = new THREE.GridHelper( size, divisions );
  // scene.add( gridHelper );

  // Axes Helper
  // var helper = new THREE.AxesHelper(2);
  // var colors = helper.geometry.attributes.color;
  // colors.setXYZ(0, 1, 0, 0);
  // colors.setXYZ(1, 1, 0, 0);
  // colors.setXYZ(2, 0, 0, 1);
  // colors.setXYZ(3, 0, 0, 1);
  // colors.setXYZ(4, 0, 1, 0);
  // colors.setXYZ(5, 0, 1, 0);
  // scene.add(helper);

  // Allow user to rotate around the robot.
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 1;

  // *** Load URDF ***

  manager = new LoadingManager();
  loader = new URDFLoader(manager);

  controls = new OrbitControls(camera, renderer.domElement);

  // 2. 调用你的控制函数
  // initTransformControls();

  loadRobot();

  // *** Resize the contents of the canvas on window resize.

  window.addEventListener('resize', onResize);
}


function initTransformControls() {
  // 1. 创建一个空物体作为“基坐标系”
  // 虽然是“空”的，但为了可见，我们可以放一个小的 AxesHelper
  baseFrameAnchor = new THREE.Object3D();
  const axesHelper = new THREE.AxesHelper(0.5); // 0.5米长的轴
  baseFrameAnchor.add(axesHelper);
  scene.add(baseFrameAnchor);

  // 2. 初始化变换控制器
  transformControls = new TransformControls(camera, renderer.domElement);

  // 重点：当拖拽物体时，必须禁用 OrbitControls，否则两者会冲突
  transformControls.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value;
  });

  // 3. 监听变化并打印坐标/旋转
  transformControls.addEventListener('change', () => {
    const pos = baseFrameAnchor.position;
    const rot = baseFrameAnchor.rotation;

    // 你可以在这里更新 UI 或 Stores
    console.log(`基坐标系位置: x:${pos.x.toFixed(3)}, y:${pos.y.toFixed(3)}, z:${pos.z.toFixed(3)}`);
    console.log(`基坐标系旋转 (Rad): x:${rot.x.toFixed(3)}, y:${rot.y.toFixed(3)}, z:${rot.z.toFixed(3)}`);
  });

  // 4. 将控制器绑定到锚点上
  transformControls.attach(baseFrameAnchor);
  scene.add(transformControls);

  // 5. 快捷键切换模式 (可选)
  window.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'g': transformControls.setMode('translate'); break; // 移动
      case 'r': transformControls.setMode('rotate'); break;    // 旋转
    }
  });
}
// *** Render the scene onto the screen ***

function render(): void {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}

function loadRobot(url = URDF_FILE_PATH, files?: Record<string, File>): void {
  if (robot) removeOldRobotFromScene();

  const filesHaveBeenUploaded = files !== undefined;
  if (filesHaveBeenUploaded) {
    loader.loadMeshCb = (
      path: string,
      manager: LoadingManager,
      onComplete: (obj: Object3D, err?: ErrorEvent) => void
    ): void => {
      const { fileName, fileExtension } = getFileNameFromPath(path);
      const fileURL = URL.createObjectURL(files[fileName]);

      switch (fileExtension) {
        case 'stl':
          loadSTL(manager, onComplete, fileURL);
          break;
        case 'dae':
          loadDAE(manager, onComplete, fileURL);
          break;
        default:
          throw new Error('Mesh format not supported');
      }
    };
  }

  loader.load(url, (result: URDFRobot): void => {
    console.log(result);
    robot = result;
  });

  // Wait until all geometry has been loaded, then add
  // the robot to the scene.
  manager.onLoad = (): void => {
    // Center the robot
    // robot.translateOnAxis(0, 0, 0);
    // robot.position.copy(new Vector3(0.0, 0.0, 0.0));
    // Traverse the robot and cast shadow
    robot.traverse((c: Object3D): void => {
      // if (c instanceof Mesh) {
      //   c.material.color.set(0xffd324);
      // }
      c.castShadow = true;
    });

    // Pass each joint's limits and initial degree to `Interface`.
    jointInfosStore.update(updateJointInfos);

    selectedUpAxisStore.update((): string => axes.Y);

    robot.scale.set(1 / scale, 1 / scale, 1 / scale);

    // Updates the global transform of the object and its descendants.
    robot.updateMatrixWorld(true);

    scene.add(robot);

    box = new THREE.Box3().setFromObject(robot);

    loadPointCloudA(scene, POINT_CLOUD_URLA);
    loadPointCloudB(scene, POINT_CLOUD_URLB);

  };
}

function removeOldRobotFromScene(): void {
  const name = scene.getObjectByName(robot.name);
  scene.remove(name);
  box = null;
  selectedUpAxisStore.update((): string => '');
}

// function rotateJoints(jointInfos: JointInfo[]): void {
//   if (!robot) return;
//
//   const { joints } = robot;
//   const jointNames = Object.keys(joints);
//   jointNames.forEach((jointName: string, idx: number): void => {
//     const { degree } = jointInfos[idx];
//     joints[jointName].setJointValue(MathUtils.degToRad(degree));
//   });
// }

function rotateJoints(jointInfos: JointInfo[]): void {
if (!robot || !Array.isArray(jointInfos)) return;

  const { joints } = robot;

  jointInfos.forEach((info) => {
    const jointName = info.name;
    const jointObject = joints[jointName];

    if (jointObject) {
      // 转换角度为弧度
      const rad = MathUtils.degToRad(info.degree);
      
      jointObject.setJointValue(rad);
    } else {
      console.warn(`模型中未找到关节: ${jointName}`);
    }
  });
}


function updateJointInfos(): JointInfo[] {
  return Object.keys(robot.joints)
    .filter((jointName) => jointName !== 'base_jointA' && jointName !== 'base_jointB')
    .map((jointName: string) => {
    const limit = robot.joints[jointName].limit || { lower: 0, upper: 0 };
    const { lower, upper } = limit;
    const lowerDegree = Number(MathUtils.radToDeg(Number(lower)).toFixed());
    const upperDegree = Number(MathUtils.radToDeg(Number(upper)).toFixed());
    const jointHasLimit = lowerDegree !== 0 || upperDegree !== 0;

    return {
      name: jointName,
      lower: jointHasLimit ? lowerDegree : -Infinity,
      upper: jointHasLimit ? upperDegree : Infinity,
      degree: 0,
    };
  });
}


function rotateRobotOnUpAxisChange(selectedUpAxis: string): void {
  if (!robot || selectedUpAxis === '') return;

  switch (selectedUpAxis) {
    case axes.X:
      setRobotRotation(robot, 0, 0, Math.PI / 2);
      break;
    case axes.NEGATIVE_X:
      setRobotRotation(robot, 0, 0, -Math.PI / 2);
      break;
    case axes.Y:
      setRobotRotation(robot, 0, 0, 0);
      break;
    case axes.NEGATIVE_Y:
      setRobotRotation(robot, Math.PI, 0, 0);
      break;
    case axes.Z:
      setRobotRotation(robot, -Math.PI / 2, 0, 0);
      break;
    case axes.NEGATIVE_Z:
      setRobotRotation(robot, Math.PI / 2, 0, 0);
      break;
    default:
      throw new Error('Should not reach here');
  }

  // If we set camera position and orbit controls' target
  // before the robot is initially rotated, robot will appear
  // off center and orbit controls will not behave correctly.
  if (!box) {
    // Create a bounding box of robot.
    box = new Box3().setFromObject(robot);

    const boxSize = box.getSize(new Vector3()).length();
    const boxCenter = box.getCenter(new Vector3());

    // robot.position.x -= box.min.y;

    scaleInView(boxSize * 0.5, boxSize, boxCenter, camera);

    controls.target.y = boxCenter.y;
    controls.update();
  }
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
}

export default createScene;
export { rotateJoints, loadRobot, rotateRobotOnUpAxisChange };
