var createApp = Vue.createApp;

createApp({
  data: function() {
    return {
      token: localStorage.getItem('teamup_token') || '',
      user: JSON.parse(localStorage.getItem('teamup_user') || 'null'),
      group: null,
      comments: [],
      commentContent: '',
      toast: ''
    };
  },
  mounted: function() {
    if (!this.user || !this.token) {
      window.location.href = '/login';
      return;
    }
    this.loadGroup();
    this.loadComments();
  },
  methods: {
    groupId: function() {
      var parts = window.location.pathname.split('/');
      return parts[parts.length - 1];
    },
    api: function(path, options) {
      options = options || {};
      options.headers = options.headers || {};
      if (this.token) {
        options.headers.Authorization = 'Bearer ' + this.token;
      }
      if (options.body && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
      return fetch('/api' + path, options).then(function(res) {
        return res.json().then(function(data) {
          if (!res.ok) {
            throw new Error(data.message || '操作失敗');
          }
          return data;
        });
      });
    },
    showToast: function(message) {
      var vm = this;
      this.toast = message;
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(function() {
        vm.toast = '';
      }, 2400);
    },
    logout: function() {
      localStorage.removeItem('teamup_token');
      localStorage.removeItem('teamup_user');
      window.location.href = '/login';
    },
    loadGroup: function() {
      var vm = this;
      return this.api('/groups/' + this.groupId()).then(function(data) {
        data.group.accepting_applications = !!data.group.accepting_applications;
        vm.group = data.group;
      }).catch(function(err) {
        vm.showToast(err.message);
        window.setTimeout(function() {
          window.location.href = '/';
        }, 900);
      });
    },
    loadComments: function() {
      var vm = this;
      return this.api('/groups/' + this.groupId() + '/comments').then(function(data) {
        vm.comments = data.comments;
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    createComment: function() {
      var vm = this;
      if (!this.commentContent) {
        this.showToast('請先輸入留言內容');
        return;
      }
      return this.api('/groups/' + this.groupId() + '/comments', {
        method: 'POST',
        body: JSON.stringify({ content: this.commentContent })
      }).then(function() {
        vm.commentContent = '';
        vm.showToast('留言已送出');
        vm.loadComments();
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    formatTime: function(value) {
      if (!value) {
        return '';
      }
      return new Date(value.replace(' ', 'T')).toLocaleString('zh-TW');
    },
    statusText: function(status) {
      return {
        open: '招募中',
        full: '已滿員',
        closed: '已關閉'
      }[status] || status;
    }
  }
}).mount('#app');
