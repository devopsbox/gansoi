var Collection = function(identifier) {
    var self = this;

    self.data = new Array();

    self.insert = function(obj) {
        self.data.push(obj);
    };

    self.deleteId = function(id) {
        self.data = self.data.filter(function(obj) {
            return obj[identifier] !== id;
        });
    };

    self.upsert = function(obj) {
        var index = self.data.findIndex(function(element) {
            if (element[identifier] === obj[identifier]) {
                return true;
            }

            return false;
        });

        if (index >= 0) {
            // We must use splice, if we simply replace the element Vue will
            // never notice.
            // https://vuejs.org/v2/guide/list.html#Caveats
            self.data.splice(index, 1, obj);
        } else {
            self.insert(obj);
        }
    };

    self.get = function(id) {
        var ret = self.data.find(function(element) {
            if (element[identifier] === id) {
                return true;
            }
        });

        return ret;
    };

    self.log = function(log) {
        switch (log.command) {
            case 'delete':
                self.deleteId(log.data[identifier]);
                break;
            case 'save':
                self.upsert(log.data);
                break;
            default:
                console.dir(log);
        }
    };
};

var checks = new Collection('id');
var nodes = new Collection('name');

var agents = new Array();
agents.get = function(name) {
    return agents.find(function(agent) {
        if (agent.name === name) {
            return true;
        }

        return false;
    })
};

var listChecks = Vue.component('list-checks', {
    data: function() {
        return {
            checks: checks
        };
    },

    methods: {
        deleteCheck: function(button, id) {
            button.disabled = true;

            Vue.http.delete('/checks/' + id);
        },

        editCheck: function(id) {
            router.push('/check/edit/' + id);
        }
    },

    template: '#template-checks'
});

var listNodes = Vue.component('list-nodes', {
    data: function() {
        return {
            nodes: nodes
        };
    },

    template: '#template-nodes'
});

Vue.http.get('/agents').then(function(response) {
    response.body.forEach(function(check) {
        agents.push(check);
    });
});

Vue.http.get('/checks').then(function(response) {
    response.body.forEach(function(check) {
        checks.upsert(check);
    });
});

var live = new WebSocket('wss://' + window.location.host + '/live');
live.onmessage = function(event) {
    var data = JSON.parse(event.data);

    switch (data.type) {
        case 'nodeinfo':
            nodes.log(data);
            break;
        case 'checkresult':
            break;
        case 'check':
            checks.log(data);
            break;
        default:
            console.log(data);
    }
};

var editCheck = Vue.component('edit-check', {
    data: function() {
        return {
            title: 'Add check',
            agents: agents,
            check: {
                arguments: {},
                agent: 'http',
                id: '',
                expressions: []
            },
            results: {results:{}},
        };
    },

    created: function() {
        // fetch the data when the view is created and the data is
        // already being observed
        this.fetchData()
    },

    watch: {
        '$route': 'fetchData'
    },

    methods: {
        addExpression: function() {
            this.check.expressions.push('');
        },

        removeExpression: function(index) {
            this.check.expressions.splice(index, 1);
        },

        fetchData: function() {
            var check = checks.get(this.$route.params.id);

            if (check != undefined) {
                this.title = "Edit " + this.$route.params.id;
                this.check = check;
            }
        },

        testCheck: function() {
            this.$http.post("/test", this.check).then(function(response) {
                this.results = response.body;
            });
        },

        addCheck: function() {
            this.$http.post("/checks", this.check).then(function(response) {
                router.push('/checks');
            });
        }
    },

    computed: {
        arguments: function () {
            var agentId = this.check.agent;
            var agent = agents.get(agentId);

            console.log(agentId);
            console.log(agent);

            return agent.arguments;
        }
    },

    template: '#template-edit-check'
});

const router = new VueRouter({
    routes: [
        { path: '/', component: { template: '<h1>Hello, world.</h1>' } },
        { path: '/overview', component: { template: '#template-overview' } },
        { path: '/gansoi', component: listNodes },
        { path: '/checks', component: listChecks },
        { path: '/check/edit/:id', component: editCheck }
    ]
});

const app = new Vue({
    el: '#app',
    router: router
});