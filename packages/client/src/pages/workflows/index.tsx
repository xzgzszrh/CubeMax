import { useNavigate } from 'react-router-dom';

import { Button } from '@buildingai/ui/components/ui/button';

export default function WorkflowsIndexPage() {
  const navigate = useNavigate();

  const handleCreate = async () => {
    // 临时：直接跳转到新编辑器（后续接入API）
    navigate('/workflows/new');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">工作流</h1>
        <Button onClick={handleCreate}>新建工作流</Button>
      </div>
      <p className="text-muted-foreground">暂无工作流，点击新建开始创建。</p>
    </div>
  );
}
