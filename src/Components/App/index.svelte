<script lang="ts">
  import { jointInfosStore, selectedUpAxisStore } from "../../stores";
  import type { JointInfo } from "../../types";
  import Interface from "../Interface/InterfaceDrawer.svelte";
  import Scene from "../Scene/index.svelte";
  import Monitor from "../Monitor/Monitor.svelte";

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
</style>
