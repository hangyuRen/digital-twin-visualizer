<script lang="ts">
  import { jointInfosStore, selectedUpAxisStore } from "../../stores";
  import type { JointInfo } from "../../types";
  import Interface from "../Interface/InterfaceDrawer.svelte";
  import Scene from "../Scene/index.svelte";
  import Monitor from "../Monitor/Monitor.svelte";
  import PointCloudPanel from '../PointCloud/PointCloudPanel.svelte';
  // 控制界面显示的变量
  let activeTab: 'robot' | 'monitor' = 'robot';

  let jointInfos: JointInfo[] = [];
  jointInfosStore.subscribe((value: JointInfo[]): void => {
    jointInfos = value;
  });

  let selectedUpAxis = "";
  selectedUpAxisStore.subscribe((value: string): void => {
    selectedUpAxis = value;
  });

  // 切换函数
  const toggleView = () => {
    activeTab = activeTab === 'robot' ? 'monitor' : 'robot';
  };

  // import WSClient from '../../wsClient/wsClient';
  //
  // let wsClient = new WSClient('ws://127.0.0.1:8080');
  // wsClient.start();
</script>

<!--
  When passing `props` to a child component, use `bind` only if it is
  a two way binding, which means the child component will also update the `props`
  in the parent component.
-->
<div class="fixed top-4 right-4 z-[100]">
  <button class="btn btn-primary shadow-lg" on:click={toggleView}>
    {#if activeTab === 'robot'}
      进入监控看板 →
    {:else}
      ← 返回 3D 模型
    {/if}
  </button>
</div>

<div class="relative w-full h-screen overflow-hidden bg-base-100">
  {#if activeTab === 'robot'}
    <div class="drawer h-full">
      <Interface bind:jointInfos bind:selectedUpAxis />
      <Scene {jointInfos} {selectedUpAxis} />

   <!-- 左侧点云展示框 -->
  <div class="pc-slot pc-left">
    <PointCloudPanel title="左侧管道点云" />
  </div>

  <!-- 右侧点云展示框 -->
  <div class="pc-slot pc-right">
    <PointCloudPanel title="右侧管道点云" />
  </div>

    </div>
  {:else}
    <Monitor />
  {/if}
</div>

<style global lang="postcss">
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  /* 彻底禁掉 body 的滚动条，防止布局溢出 */
  :global(html, body) {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  /* 确保主容器可被绝对定位叠加 */
  .app-root {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .pc-slot {
    position: absolute;
    z-index: 50; /* 保证盖在three主场景上 */
    pointer-events: auto;
  }

  /* 左框：对应你截图左上红框 */
  .pc-left {
    top: 14px;
    left: 14px;
    width: min(38vw, 520px);
    height: min(34vh, 320px);
    min-width: 320px;
    min-height: 240px;
  }

  /* 右框：对应你截图右上红框（避开右上“进入沉浸模式”按钮） */
  .pc-right {
    top: 78px;
    right: 14px;
    width: min(30vw, 420px);
    height: min(28vh, 260px);
    min-width: 280px;
    min-height: 220px;
  }
/* 小屏适配：避免挡住主体 */
  @media (max-width: 980px) {
    .pc-left {
      width: 360px;
      height: 260px;
    }
    .pc-right {
      top: 360px;
      width: 360px;
      height: 260px;
    }
  }
</style>
