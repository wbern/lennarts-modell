import Vue from 'vue';
import App from './App.vue';

import 'swiped-events/dist/swiped-events.min.js';

Vue.config.productionTip = false;

new Vue({
    render: h => h(App),
}).$mount('#app');
