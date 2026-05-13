import { createApp } from 'vue'
import App from './App.vue'

/* import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]); */

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'

// Регистрируем всё: и Community, и Enterprise модули
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule])

import '../src/styles/style.css'

createApp(App).mount('#app')