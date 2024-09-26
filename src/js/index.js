import "jsvectormap/dist/css/jsvectormap.css";
import "flatpickr/dist/flatpickr.min.css";
import "../css/satoshi.css";
import "../css/style.css";

import Alpine from "alpinejs";
import persist from "@alpinejs/persist";
import PineconeRouter from 'pinecone-router'

// Alpine.plugin(persist);
const BASE_PATH = '/management';
const getDataFromAPI = async (path, search) => {
  const searchParams = new URLSearchParams();
  if (search) {
    searchParams.append('search', search);
  }
  const topicsResponse = await fetch(`/management/api/${path}${search ? `?${searchParams.toString()}` : ''}`);
  return await topicsResponse.json();
}

Alpine.store('main', {
  loading: false,
  page: 'main',
  search: '',
  list: [],
  item: {},
  // path: '',
  async getData(path, search) {
    this.loading = true;

    if (path === '') {
      const meta = await getDataFromAPI('meta');
      this.item = { meta };
    }

    if (path === 'topics') {
      this.list = await getDataFromAPI('topic', search);
    }

    if (path === 'ingresses') {
      this.list = await getDataFromAPI('ingress', search);
    }

    if (path === 'egresses') {
      this.list = await getDataFromAPI('egress', search);
    }

    if (path === 'messages') {
      this.list = await getDataFromAPI('message', search);
    }

    if (/^ingresses\/IGRS.*$/.test(path)) {
      const pathParts = path.split('/');
      this.item = await getDataFromAPI(`ingress/${pathParts[1]}`);
    }

    if (/^messages\/MSSG.*$/.test(path)) {
      const pathParts = path.split('/');
      this.item = await getDataFromAPI(`message/${pathParts[1]}`);
    }

    this.list = this.list.map((e) => { 
      if (!e.createAt) {
        return e;
      }
      const date = new Date(e.createAt);
      const createAt = `${date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })} ${ date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })}`
      return { ...e, createAt: createAt }
    });
    this.loading = false
  },
  async searchData(search) {
    this.getData(this.page, search)
  },
  async routeTo(path, router) {
    router.navigate(`/${path || ''}`);
    this.search = '';
    this.page = path;
    await this.getData(path);
  },
  async initRouter(router) {
    const parts = window.location.pathname.split(`${BASE_PATH}/`);
    this.routeTo(parts[1], router);
  }
});

Alpine.plugin(PineconeRouter);
window.PineconeRouter.settings.basePath = BASE_PATH;
window.Alpine = Alpine;
Alpine.start();

// Document Loaded
document.addEventListener("alpine:init", () => {
});
