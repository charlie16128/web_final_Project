var createApp = Vue.createApp;

createApp({
  data: function() {
    return {
      token: localStorage.getItem('teamup_token') || '',
      user: JSON.parse(localStorage.getItem('teamup_user') || 'null'),
      group: null,
      comments: [],
      commentContent: '',
      commentSignature: '',
      pollingTimer: null,
      toast: ''
    };
  },
  mounted: function() {
    if (!this.user || !this.token) {
      window.location.href = '/login';
      return;
    }
    this.loadGroup();
    this.loadComments(false);
    this.startPolling();
  },
  beforeUnmount: function() {
    this.stopPolling();
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
    startPolling: function() {
      var vm = this;
      this.stopPolling();
      this.pollingTimer = window.setInterval(function() {
        if (!document.hidden) {
          vm.loadComments(true);
        }
      }, 3000);
    },
    stopPolling: function() {
      if (this.pollingTimer) {
        window.clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
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
    loadComments: function(silent) {
      var vm = this;
      return this.api('/groups/' + this.groupId() + '/comments').then(function(data) {
        var signature = data.comments.map(function(comment) {
          return comment.id + ':' + comment.created_at + ':' + comment.content;
        }).join('|');
        if (signature !== vm.commentSignature) {
          vm.commentSignature = signature;
          vm.comments = data.comments;
        }
      }).catch(function(err) {
        if (!silent) {
          vm.showToast(err.message);
        }
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
        vm.loadComments(false);
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    formatTime: function(value) {
      if (!value) {
        return '';
      }
      var normalized = value.indexOf('T') >= 0 ? value : value.replace(' ', 'T');
      if (!/[zZ]|[+-]\d\d:\d\d$/.test(normalized)) {
        normalized += 'Z';
      }
      var date = new Date(normalized);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
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
