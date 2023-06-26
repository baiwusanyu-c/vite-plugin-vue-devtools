import { createApp, h } from 'vue'

// 虚拟模块。这是客户端的根组件
import App from 'virtual:vue-devtools-path:Container.vue'

// TODO: 猜测这是在客户端的事件执行方法，用于执行服务端的事件消息等
const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__ ??= {
  events: new Map(),
  on(event, fn) {
    if (!this.events.has(event))
      this.events.set(event, [])

    this.events.get(event).push(fn)
  },
  emit(event, ...payload) {
    if (this.events.has(event))
      this.events.get(event).forEach(fn => fn(...payload))
  },
}

// 挂载客户端，这段代码会被发送到浏览器中并执行
function load() {
  const CONTAINER_ID = '__vue-devtools-container__'
  const el = document.createElement('div')
  el.setAttribute('id', CONTAINER_ID)
  el.setAttribute('data-v-inspector-ignore', 'true')
  document.getElementsByTagName('body')[0].appendChild(el)
  createApp({
    render: () => h(App, { hook }),
    devtools: {
      hide: true,
    },
  }).mount(el)
}
load()
