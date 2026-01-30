import React, { useEffect } from 'react';

// This hook adjusts the height of a textarea based on its content.
const useAutosizeTextArea = (
  textAreaRef: React.RefObject<HTMLTextAreaElement>,
  value: string
) => {
  useEffect(() => {
    if (textAreaRef.current) {
      // Temporarily shrink the textarea to calculate the true scroll height.
      textAreaRef.current.style.height = "0px";
      const scrollHeight = textAreaRef.current.scrollHeight;

      // Set the height to the scroll height to fit the content perfectly.
      textAreaRef.current.style.height = scrollHeight + "px";
    }
  }, [textAreaRef, value]);
};

export default useAutosizeTextArea;