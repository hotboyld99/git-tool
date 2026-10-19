import { useUi } from '../../stores/ui.store'
import { ConfirmationDialog } from './ConfirmationDialog'
import { CreateBranchDialog } from './CreateBranchDialog'
import { RenameBranchDialog } from './RenameBranchDialog'
import { StashDialog } from './StashDialog'
import { CreateTagDialog } from './CreateTagDialog'
import { ResetDialog } from './ResetDialog'
import { RemoteDialog } from './RemoteDialog'
import { SettingsDialog } from './SettingsDialog'
import { InteractiveRebaseDialog } from './InteractiveRebaseDialog'
import { FlowStartDialog } from './FlowStartDialog'
import { WorktreeDialog } from './WorktreeDialog'
import { NotRepositoryDialog } from './NotRepositoryDialog'

export function DialogHost() {
  const dialog = useUi((s) => s.dialog)
  switch (dialog?.type) {
    case 'confirm':
      return <ConfirmationDialog dialog={dialog} />
    case 'createBranch':
      return <CreateBranchDialog dialog={dialog} />
    case 'renameBranch':
      return <RenameBranchDialog dialog={dialog} />
    case 'stash':
      return <StashDialog dialog={dialog} />
    case 'createTag':
      return <CreateTagDialog dialog={dialog} />
    case 'reset':
      return <ResetDialog dialog={dialog} />
    case 'remote':
      return <RemoteDialog dialog={dialog} />
    case 'settings':
      return <SettingsDialog />
    case 'interactiveRebase':
      return <InteractiveRebaseDialog dialog={dialog} />
    case 'flowStart':
      return <FlowStartDialog dialog={dialog} />
    case 'worktree':
      return <WorktreeDialog dialog={dialog} />
    case 'notRepository':
      return <NotRepositoryDialog dialog={dialog} />
    default:
      return null
  }
}
