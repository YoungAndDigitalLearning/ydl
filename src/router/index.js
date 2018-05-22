import Vue from "vue"
import Router from "vue-router"
import BootstrapVue from "bootstrap-vue"
import MainPage from "@/components/MainPage"

Vue.use(Router)
Vue.use(BootstrapVue)

export default new Router({
  routes: [
    {
      path: "/",
      name: "SKB.CMS",
      component: MainPage
    }
  ]
})
