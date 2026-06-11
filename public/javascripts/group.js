var createApp = Vue.createApp;

createApp({
  data: function() {
    return {
      token: localStorage.getItem('teamup_token') || '',
      user: JSON.parse(localStorage.getItem('teamup_user') || 'null'),
      group: null,
      showEditForm: false,
      editForm: {
        title: '',
        course_name: '',
        teacher_name: '',
        current_members: 1,
        max_members: 4,
        status: 'open',
        required_skills: '',
        contact: '',
        accepting_applications: true,
        description: ''
      },
      applications: [],
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
        vm.fillEditForm(data.group);
        if (data.group.relation === 'owned') {
          return vm.loadApplications();
        }
        vm.applications = [];
      }).catch(function(err) {
        vm.showToast(err.message);
        window.setTimeout(function() {
          window.location.href = '/';
        }, 900);
      });
    },
    fillEditForm: function(group) {
      this.editForm = {
        title: group.title || '',
        course_name: group.course_name || '',
        teacher_name: group.teacher_name || '',
        current_members: Number(group.current_members || 1),
        max_members: Number(group.max_members || 4),
        status: group.status || 'open',
        required_skills: group.required_skills || '',
        contact: group.contact || '',
        accepting_applications: !!group.accepting_applications,
        description: group.description || ''
      };
    },
    toggleEditForm: function() {
      if (!this.showEditForm && this.group) {
        this.fillEditForm(this.group);
      }
      this.showEditForm = !this.showEditForm;
    },
    cancelEditForm: function() {
      if (this.group) {
        this.fillEditForm(this.group);
      }
      this.showEditForm = false;
    },
    saveProject: function() {
      var vm = this;
      if (!this.group || this.group.relation !== 'owned') {
        this.showToast('只有專案建立者可以修改');
        return;
      }
      return this.api('/projects/' + this.group.id, {
        method: 'PUT',
        body: JSON.stringify(this.editForm)
      }).then(function() {
        vm.showEditForm = false;
        vm.showToast('專案資料已儲存');
        return vm.loadGroup();
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    loadApplications: function() {
      var vm = this;
      if (!this.group || this.group.relation !== 'owned') {
        this.applications = [];
        return Promise.resolve();
      }
      return this.api('/projects/' + this.group.id + '/applications').then(function(data) {
        vm.applications = data.applications || [];
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    updateApplication: function(application, status) {
      var vm = this;
      return this.api('/applications/' + application.id, {
        method: 'PUT',
        body: JSON.stringify({ status: status })
      }).then(function() {
        vm.showToast(status === 'accepted' ? '已接受申請' : '已拒絕申請');
        return vm.loadGroup();
      }).catch(function(err) {
        vm.showToast(err.message);
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
        this.showToast('請輸入留言內容');
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
        open: '開放中',
        full: '已額滿',
        closed: '已關閉'
      }[status] || status;
    }
  }
}).mount('#app');
