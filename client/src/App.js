import React, { Component, Fragment } from 'react';

// Router
import { BrowserRouter as Router, Route } from 'react-router-dom';

// Imports
// import { Login } from './components';
import Nav from './container/nav/Nav';
import Body from './container/body';

import './App.css';
import LandingPage from './container/landingpage';

class App extends Component {
  state = {
    isLoggedOn: false
    // TODO: make isLoggedOn switch
  }

  render() {
    return <div className="App">
        <Router>
          <Fragment>
            {this.state.isLoggedOn ? <Nav /> : <Fragment />}
          <Route path="/" component={Body} />
        </Fragment>
        </Router>
      </div>;
  }
}

export default App;
