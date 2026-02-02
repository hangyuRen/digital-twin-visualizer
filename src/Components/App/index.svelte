<script lang="ts">
  import { jointInfosStore, selectedUpAxisStore } from "../../stores";
  import type { JointInfo } from "../../types";

  import Interface from "../Interface/InterfaceDrawer.svelte";
  import Scene from "../Scene/index.svelte";

  let jointInfos: JointInfo[] = [];
  jointInfosStore.subscribe((value: JointInfo[]): void => {
    jointInfos = value;
  });


  let selectedUpAxis = "";
  selectedUpAxisStore.subscribe((value: string): void => {
    selectedUpAxis = value;
  });

  import WSClient from '../../wsClient/wsClient';

  let wsClient = new WSClient('ws://127.0.0.1:8080');
  wsClient.start();
</script>

<!--
  When passing `props` to a child component, use `bind` only if it is
  a two way binding, which means the child component will also update the `props`
  in the parent component.
-->

<div class="drawer">
  <Interface bind:jointInfos bind:selectedUpAxis />
  <Scene {jointInfos} {selectedUpAxis} />
</div>

<style global lang="postcss">
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>
