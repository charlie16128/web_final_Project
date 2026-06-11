var createApp = Vue.createApp;

createApp({
  data: function() {
    return {
      token: localStorage.getItem('teamup_token') || '',
      user: JSON.parse(localStorage.getItem('teamup_user') || 'null'),
      projects: [],
      groups: {
        owned: [],
        joined: []
      },
      groupTab: 'all',
      showProjectForm: false,
      myApplications: [],
      filters: {
        q: '',
        status: ''
      },
      projectForm: this.emptyProjectForm(),
      toast: '',
      searchTimer: null
    };
  },
  computed: {
    visibleGroups: function() {
      if (this.groupTab === 'owned') {
        return this.groups.owned;
      }
      if (this.groupTab === 'joined') {
        return this.groups.joined;
      }
      return this.groups.owned.concat(this.groups.joined);
    },
    groupCounts: function() {
      return {
        owned: this.groups.owned.length,
        joined: this.groups.joined.length,
        all: this.groups.owned.length + this.groups.joined.length
      };
    }
  },
  mounted: function() {
    if (!this.user || !this.token) {
      window.location.href = '/login';
      return;
    }
    this.loadProjects();
    this.loadMyApplications();
    this.loadGroups();
  },
  methods: {
    emptyProjectForm: function() {
      return {
        title: '',
        course_name: '',
        teacher_name: '',
        current_members: 1,
        max_members: 4,
        contact: '',
        required_skills: '',
        accepting_applications: true,
        description: ''
      };
    },
    toggleProjectForm: function() {
      this.showProjectForm = !this.showProjectForm;
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
      this.token = '';
      this.user = null;
      localStorage.removeItem('teamup_token');
      localStorage.removeItem('teamup_user');
      window.location.href = '/login';
    },
    scheduleProjectLoad: function() {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(this.loadProjects, 250);
    },
    loadProjects: function() {
      var vm = this;
      var params = new URLSearchParams();
      if (this.filters.q) {
        params.set('q', this.filters.q);
      }
      if (this.filters.status) {
        params.set('status', this.filters.status);
      }

      return this.api('/projects?' + params.toString()).then(function(data) {
        vm.projects = data.projects.map(function(project) {
          project.accepting_applications = !!project.accepting_applications;
          project.applyMessage = '';
          project.commentContent = '';
          project.comments = [];
          project.applications = [];
          return project;
        });
        vm.projects.forEach(function(project) {
          vm.loadComments(project);
          if (vm.user && vm.user.id === project.owner_id) {
            vm.loadProjectApplications(project);
          }
        });
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    loadGroups: function() {
      var vm = this;
      return this.api('/groups/me').then(function(data) {
        vm.groups.owned = data.owned || [];
        vm.groups.joined = data.joined || [];
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    loadComments: function(project) {
      var vm = this;
      return this.api('/projects/' + project.id + '/comments').then(function(data) {
        project.comments = data.comments;
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    loadProjectApplications: function(project) {
      return this.api('/projects/' + project.id + '/applications').then(function(data) {
        project.applications = data.applications;
      }).catch(function() {});
    },
    loadMyApplications: function() {
      var vm = this;
      return this.api('/my-applications').then(function(data) {
        vm.myApplications = data.applications;
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    createProject: function() {
      var vm = this;
      return this.api('/projects', {
        method: 'POST',
        body: JSON.stringify(this.projectForm)
      }).then(function() {
        vm.projectForm = vm.emptyProjectForm();
        vm.showProjectForm = false;
        vm.showToast('專案已建立');
        vm.loadProjects();
        vm.loadGroups();
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    canApply: function(project) {
      return project.accepting_applications && project.status === 'open' && this.user && this.user.id !== project.owner_id;
    },
    applyProject: function(project) {
      var vm = this;
      if (!this.canApply(project)) {
        this.showToast('此專案目前無法申請加入');
        return;
      }
      return this.api('/projects/' + project.id + '/apply', {
        method: 'POST',
        body: JSON.stringify({ message: project.applyMessage })
      }).then(function() {
        project.applyMessage = '';
        vm.showToast('已送出申請');
        vm.loadMyApplications();
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    createComment: function(project) {
      var vm = this;
      return this.api('/projects/' + project.id + '/comments', {
        method: 'POST',
        body: JSON.stringify({ content: project.commentContent })
      }).then(function() {
        project.commentContent = '';
        vm.showToast('留言已送出');
        vm.loadComments(project);
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    updateApplication: function(project, application, status) {
      var vm = this;
      return this.api('/applications/' + application.id, {
        method: 'PUT',
        body: JSON.stringify({ status: status })
      }).then(function() {
        project.applications = project.applications.filter(function(item) {
          return item.id !== application.id;
        });
        vm.showToast('申請狀態已更新');
        vm.loadProjects();
        vm.loadGroups();
      }).catch(function(err) {
        vm.showToast(err.message);
      });
    },
    statusText: function(status) {
      return {
        open: '招募中',
        full: '已滿員',
        closed: '已關閉',
        pending: '待審核',
        accepted: '已接受',
        rejected: '已拒絕'
      }[status] || status;
    }
  }
}).mount('#app');
