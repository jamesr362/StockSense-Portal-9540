import React from 'react';
import * as FiIcons from 'react-icons/fi';
import * as RiIcons from 'react-icons/ri';
import { FiAlertTriangle } from 'react-icons/fi';

const SafeIcon = ({ icon, name, ...props }) => {
  let IconComponent;
  
  try {
    if (icon) {
      IconComponent = icon;
    } else if (name) {
      // Check in Fi icons first
      if (name.startsWith('Fi')) {
        IconComponent = FiIcons[name];
      }
      // Check in Ri icons if not found in Fi
      else if (name.startsWith('Ri')) {
        IconComponent = RiIcons[name];
      }
    }
  } catch (e) {
    IconComponent = null;
  }
  
  return IconComponent ? React.createElement(IconComponent, props) : <FiAlertTriangle {...props} />;
};

export default SafeIcon;