import { motion } from 'framer-motion';
import { RiCheckLine, RiCloseLine } from 'react-icons/ri';

export default function RoleComparison() {
  const features = [
    {
      category: 'Inventory Management',
      features: [
        {
          name: 'View Inventory',
          admin: true,
          staff: true,
          description: 'Browse and search through inventory items'
        },
        {
          name: 'Add/Edit Items',
          admin: true,
          staff: false,
          description: 'Create new items or modify existing ones'
        },
        {
          name: 'Update Stock Levels',
          admin: true,
          staff: true,
          description: 'Adjust quantity after sales or deliveries'
        },
        {
          name: 'Delete Items',
          admin: true,
          staff: false,
          description: 'Remove items from inventory'
        }
      ]
    },
    {
      category: 'User Management',
      features: [
        {
          name: 'View Team Members',
          admin: true,
          staff: true,
          description: 'See list of team members'
        },
        {
          name: 'Invite Users',
          admin: true,
          staff: false,
          description: 'Add new team members'
        },
        {
          name: 'Manage Permissions',
          admin: true,
          staff: false,
          description: 'Set user roles and access levels'
        }
      ]
    },
    {
      category: 'Reporting & Analytics',
      features: [
        {
          name: 'View Basic Reports',
          admin: true,
          staff: true,
          description: 'Access standard inventory reports'
        },
        {
          name: 'Create Custom Reports',
          admin: true,
          staff: false,
          description: 'Generate specialized reports'
        },
        {
          name: 'Export Data',
          admin: true,
          staff: false,
          description: 'Download inventory data'
        }
      ]
    },
    {
      category: 'System Settings',
      features: [
        {
          name: 'View Settings',
          admin: true,
          staff: true,
          description: 'See system configuration'
        },
        {
          name: 'Modify Settings',
          admin: true,
          staff: false,
          description: 'Change system configuration'
        },
        {
          name: 'Configure Alerts',
          admin: true,
          staff: false,
          description: 'Set up inventory alerts'
        }
      ]
    }
  ];

  return (
    <div className="mt-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Role-Based Access Comparison</h2>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50 border-b">
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500">Feature</h3>
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-500">Admin</h3>
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-500">Staff</h3>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {features.map((category) => (
              <div key={category.category} className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{category.category}</h3>
                <div className="space-y-4">
                  {category.features.map((feature) => (
                    <motion.div
                      key={feature.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5 }}
                      className="grid grid-cols-4 gap-4 items-center"
                    >
                      <div className="col-span-2">
                        <p className="font-medium text-gray-900">{feature.name}</p>
                        <p className="text-sm text-gray-500">{feature.description}</p>
                      </div>
                      <div className="text-center">
                        {feature.admin ? (
                          <RiCheckLine className="mx-auto h-6 w-6 text-green-500" />
                        ) : (
                          <RiCloseLine className="mx-auto h-6 w-6 text-red-500" />
                        )}
                      </div>
                      <div className="text-center">
                        {feature.staff ? (
                          <RiCheckLine className="mx-auto h-6 w-6 text-green-500" />
                        ) : (
                          <RiCloseLine className="mx-auto h-6 w-6 text-red-500" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}