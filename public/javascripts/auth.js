var createApp = Vue.createApp;
var pageMode = window.location.pathname.indexOf('/register') === 0 ? 'register' : 'login';

createApp({
  data: function() {
    return {
      mode: pageMode,
      form: pageMode === 'register' ? {
        name: '',
        class_name: '',
        email: '',
        password: '',
        skills: '',
        bio: ''
      } : {
        email: '',
        password: ''
      },
      toast: ''
    };
  },
  methods: {
    submit: function() {
      var vm = this;
      var path = this.mode === 'register' ? '/register' : '/login';
      fetch('/api' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.form)
      }).then(function(res) {
        return res.json().then(function(data) {
          if (!res.ok) {
            throw new Error(data.message || '操作失敗');
          }
          return data;
        });
      }).then(function(data) {
        localStorage.setItem('teamup_token', data.token);
        localStorage.setItem('teamup_user', JSON.stringify(data.user));
        vm.showToast(vm.mode === 'register' ? '註冊成功' : '登入成功');
        window.setTimeout(function() {
          window.location.href = '/';
        }, 450);
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    showToast: function(message) {
      var vm = this;
      this.toast = message;
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(function() {
        vm.toast = '';
      }, 2400);
    }
  }
}).mount('#app');
