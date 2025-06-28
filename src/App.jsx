import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import "./App.css"; // Ensure your CSS file is properly linked

function App() {
  // State for new task input fields
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState("");
  const [newTaskSeconds, setNewTaskSeconds] = useState("");

  // State for the list of tasks
  const [list, setList] = useState([]);

  // State for editing a task: stores the ID of the task being edited
  const [editingTaskId, setEditingTaskId] = useState(null);
  // State for the text and time values within the editing input fields
  const [editedText, setEditedText] = useState("");
  const [editedMinutes, setEditedMinutes] = useState("");
  const [editedSeconds, setEditedSeconds] = useState("");

  // useRef to store timer IDs. This prevents re-renders when timer IDs change
  // and allows for efficient clearing of specific intervals.
  const activeTimers = useRef({});

  // --- Effects ---

  // Effect to request browser notification permission on component mount
  useEffect(() => {
    // Check if the browser supports Notifications and if permission hasn't already been granted
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission(); // Request permission from the user
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect for managing individual task countdown timers
  useEffect(() => {
    list.forEach((taskItem) => {
      // Condition to start a new timer:
      // 1. Task is not marked as 'done'
      // 2. Task still has time remaining
      // 3. No timer is currently active for this specific task ID
      if (
        !taskItem.done &&
        taskItem.remaining > 0 &&
        !activeTimers.current[taskItem.id]
      ) {
        // Set up a new interval for the task
        activeTimers.current[taskItem.id] = setInterval(() => {
          setList((prevList) => {
            // Use functional update to ensure we're working with the latest state
            return prevList.map((t) => {
              // Only update the specific task that this interval belongs to
              if (t.id === taskItem.id && t.remaining > 0) {
                const nextRemaining = t.remaining - 1;

                // Check if the timer has reached zero and hasn't been notified yet
                if (nextRemaining === 0 && !t.done && !t.notified) {
                  // Show browser notification if permission is granted
                  if (
                    "Notification" in window &&
                    Notification.permission === "granted"
                  ) {
                    new Notification("Task Timer Finished", {
                      body: `"${t.text}" is complete!`, // More engaging notification text
                      icon: "https://cdn-icons-png.flaticon.com/512/1827/1827349.png", // Ensure this URL is accessible
                    });
                  }
                  alert(`Time's up for task: "${t.text}"`); // Browser alert

                  // Clear the specific interval and nullify its reference in activeTimers
                  clearInterval(activeTimers.current[t.id]);
                  activeTimers.current[t.id] = null;
                  // Return updated task state: remaining time 0, and marked as notified
                  return { ...t, remaining: 0, notified: true };
                }
                // If timer is still running, just decrement remaining time
                return { ...t, remaining: nextRemaining };
              }
              // For other tasks, return them unchanged
              return t;
            });
          });
        }, 1000); // Interval runs every 1000 milliseconds (1 second)
      }

      // Condition to stop an existing timer:
      // If the task is marked 'done' OR its remaining time is 0 AND a timer is currently active for it
      if (
        (taskItem.done || taskItem.remaining === 0) &&
        activeTimers.current[taskItem.id]
      ) {
        clearInterval(activeTimers.current[taskItem.id]);
        activeTimers.current[taskItem.id] = null; // Clear the reference
      }
    });

    // Cleanup function: This runs when the component unmounts or when the 'list' dependency changes.
    // It's crucial to clear all active intervals to prevent memory leaks.
    return () => {
      Object.values(activeTimers.current).forEach((timerId) => {
        if (timerId) clearInterval(timerId); // Clear each active interval
      });
      activeTimers.current = {}; // Reset the ref object itself to an empty object
    };
  }, [list]); // This effect re-runs whenever the 'list' state array changes

  // --- Helper Functions ---

  /**
   * Formats total seconds into a "MM:SS" string.
   * Uses useCallback for memoization, preventing unnecessary re-creation on renders.
   * @param {number} totalSeconds - The total number of seconds.
   * @returns {string} Formatted time string (e.g., "05:30", "00:07").
   */
  const formatTime = useCallback((totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    // padStart ensures two digits (e.g., 5 becomes "05")
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, []); // No dependencies, so this function is created once

  // --- Event Handlers ---

  /**
   * Handles adding a new task or updating an existing one.
   * Determines action based on `editingTaskId` state.
   */
  const handleAddTask = () => {
    // Parse and validate minute and second inputs
    const minutes = Number(newTaskMinutes) || 0;
    const seconds = Number(newTaskSeconds) || 0;
    const totalDuration = minutes * 60 + seconds; // Calculate total seconds

    // Input validation for task text
    if (newTaskText.trim() === "") {
      alert("Task description cannot be empty! Please enter what you need to do.");
      return;
    }
    // Input validation for task duration
    if (totalDuration <= 0) {
      alert("Task duration must be greater than zero! Please set minutes or seconds.");
      return;
    }

    // Logic for updating an existing task (if in editing mode)
    if (editingTaskId) {
      setList((prevList) =>
        prevList.map((item) =>
          item.id === editingTaskId // Find the task by its ID
            ? {
                ...item,
                text: newTaskText, // Update text from new task input
                seconds: totalDuration, // Update initial duration
                remaining: totalDuration, // Reset remaining time
                done: false, // Assume task needs to be re-done if edited
                notified: false, // Reset notification status
              }
            : item // Return unchanged for other tasks
        )
      );
      setEditingTaskId(null); // Exit editing mode
    } else {
      // Logic for adding a brand new task
      const newId = uuidv4(); // Generate a unique ID for the new task
      setList((prevList) => [
        ...prevList, // Spread existing tasks
        {
          id: newId,
          text: newTaskText,
          done: false,
          seconds: totalDuration,
          remaining: totalDuration,
          notified: false, // Initial state: not yet notified
        },
      ]);
    }
    // Clear the new task input fields after operation
    setNewTaskText("");
    setNewTaskMinutes("");
    setNewTaskSeconds("");
  };

  /**
   * Toggles the 'done' status of a task.
   * @param {string} id - The ID of the task to toggle.
   */
  const handleToggleTask = (id) => {
    setList((prevList) =>
      prevList.map((item) =>
        item.id === id
          ? { ...item, done: !item.done, notified: false } // Toggle 'done', reset 'notified'
          : item
      )
    );
  };

  /**
   * Deletes a task from the list.
   * Also clears its associated timer if active.
   * @param {string} id - The ID of the task to delete.
   */
  const handleDeleteTask = (id) => {
    // Clear the specific interval if it's running
    if (activeTimers.current[id]) {
      clearInterval(activeTimers.current[id]);
      activeTimers.current[id] = null;
    }
    // Filter out the task to be deleted from the list
    setList((prevList) => prevList.filter((item) => item.id !== id));
  };

  /**
   * Enters editing mode for a specific task.
   * Populates the dedicated editing input fields and the main input fields.
   * @param {object} taskToEdit - The task object to be edited.
   */
  const handleEditTask = (taskToEdit) => {
    setEditingTaskId(taskToEdit.id); // Set the ID of the task being edited
    setEditedText(taskToEdit.text); // Populate editing text input
    // Calculate minutes and seconds from the task's current remaining time
    setEditedMinutes(Math.floor(taskToEdit.remaining / 60));
    setEditedSeconds(taskToEdit.remaining % 60);

    // Also pre-fill the main new task input fields for convenience
    setNewTaskText(taskToEdit.text);
    setNewTaskMinutes(Math.floor(taskToEdit.remaining / 60));
    setNewTaskSeconds(taskToEdit.remaining % 60);
  };

  /**
   * Saves the changes made to an edited task.
   * @param {string} id - The ID of the task being saved.
   */
  const handleSaveEditedTask = (id) => {
    // Parse and validate minute and second inputs for the edited task
    const minutes = Number(editedMinutes) || 0;
    const seconds = Number(editedSeconds) || 0;
    const totalDuration = minutes * 60 + seconds;

    // Input validation for edited task text
    if (editedText.trim() === "") {
      alert("Edited task description cannot be empty!");
      return;
    }
    // Input validation for edited task duration
    if (totalDuration <= 0) {
      alert("Edited task duration must be greater than zero!");
      return;
    }

    setList((prevList) =>
      prevList.map((item) =>
        item.id === id
          ? {
              ...item,
              text: editedText, // Update text from editing input
              seconds: totalDuration, // Update initial duration
              remaining: totalDuration, // Reset remaining time
              done: false, // Reset done status when duration is changed
              notified: false, // Reset notification status as timer restarts
            }
          : item
      )
    );
    // Exit editing mode and clear the editing-specific input fields
    setEditingTaskId(null);
    setEditedText("");
    setEditedMinutes("");
    setEditedSeconds("");
    // Clear the main input fields as well, as they were potentially pre-filled
    setNewTaskText("");
    setNewTaskMinutes("");
    setNewTaskSeconds("");
  };

  return (
    <div className="app-container">
      <h1>To-Do List</h1>

      <div className="input-container">
        <input
          type="text"
          placeholder={editingTaskId ? "Edit selected task..." : "Enter a new task..."}
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAddTask();
            }
          }}
        />
        <input
          type="number"
          min="0"
          placeholder="Min"
          value={newTaskMinutes}
          onChange={(e) => setNewTaskMinutes(e.target.value)}
          className="input-time"
        />
        <input
          type="number"
          min="0"
          max="59"
          placeholder="Sec"
          value={newTaskSeconds}
          onChange={(e) => setNewTaskSeconds(e.target.value)}
          className="input-time"
        />
        <button onClick={handleAddTask}>
          {editingTaskId ? "Update Task" : "Add Task"}
        </button>
      </div>

      <ul>
        {/* Map over the list of tasks to render each one */}
        {list.map((item) => (
          <li key={item.id} className={item.done ? "done" : ""}>
            {/* Conditional rendering: show edit inputs if task is being edited, otherwise show task details */}
            {editingTaskId === item.id ? (
              // Render input fields for editing mode
              <>
                <input
                  type="text"
                  className="edit-input" // CSS for inline edit input
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveEditedTask(item.id);
                    }
                  }}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={editedMinutes}
                  onChange={(e) => setEditedMinutes(e.target.value)}
                  className="input-time"
                />
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Sec"
                  value={editedSeconds}
                  onChange={(e) => setEditedSeconds(e.target.value)}
                  className="input-time"
                />
              </>
            ) : (
              // Render task display mode
              <>
                <span className="task-text">{item.text}</span> {/* CSS for task text */}
                <span className={`task-timer ${item.remaining === 0 ? "timer-finished" : ""}`}>
                  {formatTime(item.remaining)}
                </span>
              </>
            )}

            <div className="task-buttons">
              {/* Conditional rendering for buttons: Save when editing, action buttons otherwise */}
              {editingTaskId === item.id ? (
                // Show Save button when in editing mode
                <button
                  onClick={() => handleSaveEditedTask(item.id)}
                  className="save-button" // CSS for save button
                >
                  Save
                </button>
              ) : (
                // Show action buttons when not in editing mode
                <>
                  <button
                    onClick={() => handleToggleTask(item.id)}
                    className={item.done ? "undo-button" : "done-button"} // More specific class names
                  >
                    {item.done ? "Undo" : "Done"}
                  </button>
                  <button
                    onClick={() => handleEditTask(item)}
                    className="edit-button" // CSS for edit button
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTask(item.id)}
                    className="delete-button" // CSS for delete button
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;