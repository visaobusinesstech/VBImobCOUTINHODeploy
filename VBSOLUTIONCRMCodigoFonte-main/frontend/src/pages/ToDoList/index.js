/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import { useUserUiPreferences } from '../../hooks/useUserUiPreferences';

const TASKS_KEY = 'todo_tasks';

const useStyles = makeStyles((theme)=> ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '2rem'
  },
  inputContainer: {
    display: 'flex',
    width: '100%',
    marginBottom: '1rem'
  },
  input: {
    flexGrow: 1,
    marginRight: '1rem'
  },
  listContainer: {
    width: '100%',
    height: '100%',
    marginTop: '1rem',
    backgroundColor: theme.palette.background.primary,
    borderRadius: '5px',
  },
  list: {
    marginBottom: '5px',
    color: theme.palette.text.primary
  }
}));

const hydrateTasks = (saved) => {
  if (!Array.isArray(saved)) return [];
  return saved.map((t) => ({
    ...t,
    createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
    updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
  }));
};

const ToDoList = () => {
  const classes = useStyles();
  const { getPref, setPref, ready } = useUserUiPreferences();

  const [task, setTask] = useState('');
  const [tasks, setTasks] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setTasks(hydrateTasks(getPref(TASKS_KEY, [])));
    setHydrated(true);
  }, [ready, getPref]);

  useEffect(() => {
    if (!hydrated) return;
    setPref(TASKS_KEY, tasks);
  }, [tasks, hydrated, setPref]);

  const handleTaskChange = (event) => {
    setTask(event.target.value);
  };

  const handleAddTask = () => {
    if (!task.trim()) {
      return;
    }

    const now = new Date();
    if (editIndex >= 0) {
      const newTasks = [...tasks];
      newTasks[editIndex] = {text: task, updatedAt: now, createdAt: newTasks[editIndex].createdAt};
      setTasks(newTasks);
      setTask('');
      setEditIndex(-1);
    } else {
      setTasks([...tasks, {text: task, createdAt: now, updatedAt: now}]);
      setTask('');
    }
  };

  const handleEditTask = (index) => {
    setTask(tasks[index].text);
    setEditIndex(index);
  };

  const handleDeleteTask = (index) => {
    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    setTasks(newTasks);
  };

  return (
    <div className={classes.root}>
      <div className={classes.inputContainer}>
        <TextField
          className={classes.input}
          label="Nova tarefa"
          value={task}
          onChange={handleTaskChange}
          variant="outlined"
        />
        <Button variant="contained" color="primary" onClick={handleAddTask}>
          {editIndex >= 0 ? 'Salvar' : 'Adicionar'}
        </Button>
      </div>
      <div className={classes.listContainer}>
        <List>
          {tasks.map((task, index) => (
            <ListItem key={index} className={classes.list}>
              <ListItemText primary={task.text} secondary={task.updatedAt.toLocaleString()} />
              <ListItemSecondaryAction>
                <IconButton onClick={() => handleEditTask(index)}>
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => handleDeleteTask(index)}>
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </div>
    </div>
  );
};


export default ToDoList;
