# ROLE

Bạn là Senior Desktop Application Engineer, chuyên về:

- ElectronJS
- Node.js
- TypeScript
- React
- Git internals / Git CLI
- Desktop UX
- IPC security
- Performance optimization

Hãy xây dựng một ứng dụng desktop Git Client tương tự GitKraken / SourceTree, nhưng đơn giản, nhẹ, chạy hoàn toàn trên máy local.

Ứng dụng KHÔNG cần hệ thống account, login hoặc authentication riêng.

Git repository được đọc trực tiếp từ thư mục `.git` của project trên máy người dùng.

Không sử dụng GitHub/GitLab API cho các thao tác Git cơ bản.

Các thao tác Git sử dụng Git CLI đã cài trên máy:

git status
git branch
git log
git diff
git add
git reset
git commit
git pull
git push
git fetch
git stash
git checkout
git switch
git merge
...

Mục tiêu là tạo một desktop Git GUI hiện đại có trải nghiệm gần giống GitKraken.

---

# 1. TECH STACK

Sử dụng:

ElectronJS
Node.js
TypeScript
React
Vite

UI:

TailwindCSS

State management:

Zustand

Icons:

Lucide React

Terminal Git operations:

Node.js child_process

hoặc:

execa

Git binary:

git

KHÔNG sử dụng isomorphic-git cho các thao tác chính.

Lý do:

Ứng dụng cần tận dụng trực tiếp:

- ~/.gitconfig
- SSH keys
- credential helper
- Git Credential Manager
- SSH agent
- Git aliases/config hiện tại

của hệ điều hành.

---

# 2. ARCHITECTURE

Thiết kế project theo cấu trúc:

src/

  main/
    main.ts

    services/
      git.service.ts
      repository.service.ts
      settings.service.ts
      filesystem.service.ts

    git/
      status.ts
      log.ts
      branch.ts
      diff.ts
      commit.ts
      remote.ts
      stash.ts

    ipc/
      repository.ipc.ts
      git.ipc.ts
      filesystem.ipc.ts

  preload/
    preload.ts

  renderer/

    App.tsx

    components/

      layout/
        TitleBar.tsx
        TabBar.tsx
        Sidebar.tsx
        MainContent.tsx
        BottomPanel.tsx

      repository/
        RepositoryTab.tsx
        RepositorySidebar.tsx

      graph/
        CommitGraph.tsx
        CommitRow.tsx
        GraphCanvas.tsx

      branches/
        BranchTree.tsx
        LocalBranches.tsx
        RemoteBranches.tsx

      changes/
        ChangesPanel.tsx
        FileChangeList.tsx
        StagedFiles.tsx
        UnstagedFiles.tsx

      diff/
        DiffViewer.tsx
        UnifiedDiff.tsx
        SplitDiff.tsx

      commit/
        CommitPanel.tsx
        CommitDetail.tsx

      stash/
        StashList.tsx
        StashDetail.tsx

      dialogs/
        OpenRepositoryDialog.tsx
        CreateBranchDialog.tsx
        CheckoutDialog.tsx
        MergeDialog.tsx
        ConfirmationDialog.tsx

    hooks/

    stores/
      repository.store.ts
      git.store.ts
      ui.store.ts

    types/

    utils/

---

# 3. SECURITY

Electron phải cấu hình:

nodeIntegration: false

contextIsolation: true

sandbox: true khi khả thi

Renderer KHÔNG được gọi trực tiếp:

child_process
fs
git

Mọi thao tác phải đi qua:

Renderer
↓
Preload
↓
contextBridge
↓
IPC
↓
Electron Main
↓
GitService

Không expose generic shell command cho renderer.

Ví dụ KHÔNG làm:

window.exec("git " + userInput)

Thay vào đó expose API rõ ràng:

window.git.status(repoPath)

window.git.log(repoPath)

window.git.commit(repoPath, message)

window.git.push(repoPath)

---

# 4. PROJECT MANAGEMENT

Ứng dụng cho phép mở nhiều Git project.

Nút:

Open Repository

Sử dụng native Electron folder picker.

Sau khi chọn folder:

kiểm tra:

<folder>/.git

Nếu tồn tại:

load repository.

Nếu không:

hiển thị:

"This folder is not a Git repository."

---

# 5. MULTIPLE PROJECT TABS

Mỗi repository mở thành một TAB.

Ví dụ:

[ api-server ] [ mobile-app ] [ admin-web ] [+]

Tab cần hiển thị:

repository name

current branch

dirty indicator

Ví dụ:

api-server
dev ●

● = repository có file thay đổi.

Cho phép:

- mở nhiều repository
- đóng repository
- switch tab
- reopen repository gần đây

Persist danh sách repository vào:

electron-store

Ví dụ:

recentRepositories

openedRepositories

activeRepository

---

# 6. MAIN UI

Thiết kế layout tương tự GitKraken.

------------------------------------------------

TOP BAR

[ Open Repo ]

Repository tabs

api-server
mobile-app
admin-web

------------------------------------------------

Toolbar:

Pull
Push
Fetch
Branch
Stash
Refresh

------------------------------------------------

LEFT SIDEBAR

WORKSPACE

Changes

STASH

Stashes

BRANCHES

Local
  dev
  staging
  main
  feature/search
  fixbug/DSCB_02

REMOTE

origin
  dev
  staging
  main

------------------------------------------------

CENTER

Git commit graph

------------------------------------------------

RIGHT PANEL

Commit detail

hoặc

Diff Viewer

------------------------------------------------

BOTTOM / CHANGES VIEW

Unstaged Files

Staged Files

Commit message

Commit button

---

# 7. UI STYLE

Tham khảo giao diện GitKraken nhưng KHÔNG sao chép branding/logo.

Dark theme mặc định.

Phong cách:

- developer tool
- compact
- professional
- minimal
- desktop native feeling

Màu nền khoảng:

#16191d
#1e2228
#252a31

Borders nhẹ.

Font ưu tiên:

Inter
system-ui

Font code:

JetBrains Mono
Menlo
monospace

Các branch có màu phân biệt.

Ví dụ:

main = blue
dev = cyan
feature = purple
fix = pink
release = orange

Các màu nên được sinh ổn định dựa trên branch name.

---

# 8. GIT STATUS

Sử dụng:

git status --porcelain=v2 -z

Parse kết quả thành:

interface GitFileStatus {
    path: string
    originalPath?: string

    status:
      | "modified"
      | "added"
      | "deleted"
      | "renamed"
      | "untracked"
      | "conflicted"

    staged: boolean
}

Phân chia thành:

unstagedFiles

stagedFiles

---

# 9. CHANGES VIEW

Hiển thị:

Changes

Unstaged Files (4)

M src/services/user.ts
M src/index.ts
? test.txt
D old.ts


Staged Files (2)

M package.json
A src/new.ts

Cho phép click file để xem diff.

---

# 10. STAGE FILE

Khi người dùng click:

Stage

thực hiện:

git add -- <file>

Stage All:

git add -A

Sau đó refresh:

status

diff

---

# 11. UNSTAGE

Unstage file:

git restore --staged -- <file>

Có fallback cho Git cũ:

git reset HEAD -- <file>

Unstage All:

git reset HEAD

---

# 12. DISCARD CHANGES

Cho phép:

Discard file changes

Vì đây là destructive operation nên bắt buộc confirmation.

Tracked file:

git restore -- <file>

Untracked file:

không tự động dùng:

git clean -f

mà phải hiển thị warning rõ ràng trước khi delete.

---

# 13. DIFF VIEW

Khi chọn file:

hiển thị diff.

Unstaged:

git diff -- <file>

Staged:

git diff --cached -- <file>

Hỗ trợ 2 mode:

Unified

Split

Toolbar:

Unified | Split
Whitespace
Copy
Refresh

Syntax highlight dựa theo file extension.

Ví dụ:

.ts
.js
.py
.php
.java
.json
.yaml
.md

Hiển thị:

line number old

line number new

added line

deleted line

context line

---

# 14. COMMIT

UI:

Commit Message

textarea

[ Commit ]

Có thể:

Stage All & Commit

Validate:

message không được empty.

Command:

git commit -m "<message>"

Không tự escape bằng cách nối shell string.

Phải dùng arguments array:

spawn("git", [
    "-C",
    repoPath,
    "commit",
    "-m",
    message
])

Sau commit:

refresh:

status
log
branches

---

# 15. COMMIT HISTORY

Load bằng:

git log

Dùng format machine-readable.

Ví dụ:

git log \
--all \
--date=iso-strict \
--pretty=format:"..."

Data model:

interface GitCommit {

  hash: string

  shortHash: string

  parents: string[]

  authorName: string

  authorEmail: string

  date: string

  subject: string

  body?: string

  refs: string[]

}

Không parse git log bằng format dễ lỗi.

Sử dụng separators đặc biệt hoặc NUL separator.

---

# 16. COMMIT GRAPH

Đây là feature quan trọng nhất.

Thiết kế graph tương tự GitKraken.

Mỗi dòng:

graph
commit message
author
date

Ví dụ:

●──── staging
│
├──● feature/search
│  │
│  ● add search
│  │
●──┘ merge feature/search
│
● fix login
│
● initial commit

Graph phải hỗ trợ:

- multiple parent commits
- merge commit
- branch
- branch merge
- parallel branch lines

Mỗi graph lane có màu khác nhau.

Graph nên render bằng:

Canvas

hoặc

SVG.

Ưu tiên:

Canvas

để performance tốt với repository lớn.

---

# 17. GRAPH DATA

Không dùng graph ASCII của:

git log --graph

để render UI.

Thay vào đó lấy:

commit
parents
refs

Sau đó tự tính graph lanes.

Algorithm cần quản lý:

active lanes

parent mapping

merge lanes

branch colors

Pseudo model:

interface GraphNode {

    commitHash: string

    lane: number

    color: string

    edges: GraphEdge[]

}

interface GraphEdge {

    fromLane: number

    toLane: number

    type:
      | "straight"
      | "branch"
      | "merge"

}

---

# 18. PERFORMANCE GRAPH

Không load toàn bộ lịch sử Git ngay lập tức.

Initial:

100 commits

Khi scroll xuống:

load thêm 100.

Implement:

pagination / lazy loading.

Có thể dùng:

git log --skip=X -n 100

hoặc cursor bằng commit hash nếu phù hợp hơn.

UI dùng virtualization:

react-window

hoặc:

@tanstack/react-virtual

Mục tiêu:

repository có hàng chục nghìn commit vẫn dùng mượt.

---

# 19. BRANCHES

Sidebar:

BRANCHES

Local

main
dev
staging
feature/search
fixbug/DSCB

REMOTE

origin

origin/main
origin/dev
origin/staging

Command có thể sử dụng:

git for-each-ref

refs/heads

refs/remotes

Không parse output human-friendly của:

git branch

nếu có machine-readable command tốt hơn.

---

# 20. CURRENT BRANCH

Lấy bằng:

git symbolic-ref --short HEAD

Fallback detached HEAD:

git rev-parse --short HEAD

UI hiển thị rõ:

DETACHED HEAD

nếu repository đang detached.

---

# 21. CHECKOUT BRANCH

Double click branch:

checkout / switch.

git switch <branch>

Fallback:

git checkout <branch>

Nếu working directory đang dirty và Git từ chối checkout:

hiển thị Git error đầy đủ cho người dùng.

Không tự động discard changes.

---

# 22. CREATE BRANCH

Toolbar:

New Branch

Dialog:

Branch name

Base:

current branch
hoặc
selected commit

Command:

git switch -c <branch>

hoặc:

git branch <branch> <commit>

---

# 23. DELETE BRANCH

Context menu:

Delete Branch

git branch -d <branch>

Nếu Git từ chối do chưa merge:

KHÔNG tự dùng:

-D

Cho phép user chọn:

Force Delete

sau khi confirmation.

---

# 24. REMOTE BRANCH

Cho phép:

Checkout remote branch

Ví dụ:

origin/feature/test

Tạo tracking branch:

git switch --track origin/feature/test

---

# 25. REMOTES

Load:

git remote -v

Hiển thị:

origin

Fetch URL

Push URL

Không cần UI quản lý authentication.

SSH / HTTPS credentials sử dụng cấu hình Git hiện tại của máy.

---

# 26. FETCH

Toolbar:

Fetch

Command:

git fetch --all --prune

Có progress indicator.

Không block UI.

---

# 27. PULL

Toolbar:

Pull

Mặc định:

git pull

Không tự động:

--force

Nếu conflict:

refresh status

detect conflicted files

hiển thị:

Merge Conflicts

---

# 28. PUSH

Toolbar:

Push

Command:

git push

Nếu branch chưa có upstream:

detect error.

Hiển thị dialog:

"No upstream configured."

Button:

Push & Set Upstream

sau đó:

git push -u origin <branch>

Remote mặc định nếu có origin:

origin

---

# 29. GIT NETWORK OPERATIONS

Fetch / Pull / Push phải:

- asynchronous
- stream stdout
- stream stderr
- support progress
- support cancel nếu có thể

Hiển thị status:

Fetching...

Pulling...

Pushing...

Success

Failed

Không freeze Electron renderer.

---

# 30. STASH

Sidebar:

STASH

Hiển thị:

stash@{0}
stash@{1}
stash@{2}

Load:

git stash list

Lấy:

hash
index
branch
message

---

# 31. CREATE STASH

Toolbar:

Stash

Dialog:

Stash message

Options:

[x] Include untracked files

Commands:

git stash push -m "<message>"

Include untracked:

git stash push -u -m "<message>"

---

# 32. STASH ACTIONS

Context menu stash:

Apply

Pop

Drop

View

Commands:

git stash apply stash@{0}

git stash pop stash@{0}

git stash drop stash@{0}

Drop bắt buộc confirm.

---

# 33. STASH DIFF

Khi click stash:

hiển thị files thay đổi.

Có thể dùng:

git stash show --stat stash@{0}

và:

git stash show -p stash@{0}

Hiển thị bằng DiffViewer hiện tại.

---

# 34. COMMIT DETAILS

Click commit trên graph.

Right panel:

Commit

abcd123

Author
John Doe

Date
2026-10-13 14:20

Message

Fix user authentication


Parents:

983abc
773def

Branches:

dev
origin/dev

FILES CHANGED

M src/user.ts

A src/auth.ts

D src/old.ts

---

# 35. COMMIT FILE DIFF

Khi chọn file của một commit:

git diff <commit>^ <commit> -- <file>

Đối với root commit:

git show <commit> -- <file>

---

# 36. CONTEXT MENU COMMIT

Right click commit:

Checkout Commit

Create Branch Here

Create Tag

Copy Commit Hash

Copy Commit Message

Reset Current Branch Here

Cherry Pick

Revert Commit

Không cần implement tất cả ngay Phase 1.

Nhưng architecture phải hỗ trợ mở rộng.

---

# 37. MERGE

Right click branch:

Merge into current branch

Dialog:

Merge:

feature/search

into:

dev

Confirm

Command:

git merge feature/search

Nếu conflict:

status phải hiển thị:

Conflicted Files.

---

# 38. CONFLICT STATUS

Detect:

UU
AA
DD
AU
UA
DU
UD

Hiển thị section riêng:

MERGE CONFLICTS

src/user.ts
src/auth.ts

Không tự động giải quyết conflict.

Có thể thêm sau:

Use Ours

Use Theirs

Open Editor

---

# 39. REFRESH SYSTEM

Repository state phải refresh sau mỗi operation.

Ví dụ:

commit
checkout
merge
stash
pop
pull
fetch
push
reset
stage
unstage

Ngoài ra implement filesystem watching.

Có thể dùng:

chokidar

Watch:

repository working tree

và:

.git/HEAD
.git/index
.git/refs

Debounce khoảng:

300-500ms

Không refresh liên tục.

---

# 40. REPOSITORY STORE

Ví dụ:

interface RepositoryState {

  id: string

  path: string

  name: string

  currentBranch: string | null

  head: string

  dirty: boolean

  stagedFiles: GitFileStatus[]

  unstagedFiles: GitFileStatus[]

  branches: GitBranch[]

  remotes: GitRemote[]

  stashes: GitStash[]

  commits: GitCommit[]

  selectedCommit?: string

  selectedFile?: string

}

---

# 41. MULTI REPOSITORY

Mỗi repository giữ state độc lập.

Ví dụ:

repositoryStates: Record<
    RepositoryId,
    RepositoryState
>

Không dùng một global:

currentBranch

cho toàn app.

---

# 42. ERROR HANDLING

Tạo chuẩn error:

interface GitError {

    operation: string

    exitCode: number

    stdout: string

    stderr: string

    command?: string

}

Không show stack trace cho user.

UI hiển thị:

Push failed

Remote rejected the push.

[Show Details]

Khi mở details:

stderr

---

# 43. LOG PANEL

Có một operation log nhỏ ở bottom.

Ví dụ:

14:21 Fetch origin
✓ Completed in 1.4s

14:22 Checkout dev
✓ Completed in 420ms

14:23 Push
✗ Failed

Có button:

Show Git Output

---

# 44. KEYBOARD SHORTCUT

Implement:

Cmd/Ctrl + O
Open Repository

Cmd/Ctrl + Enter
Commit

Cmd/Ctrl + Shift + F
Fetch

Cmd/Ctrl + Shift + P
Push

Cmd/Ctrl + Shift + L
Pull

Cmd/Ctrl + R
Refresh

Cmd/Ctrl + W
Close Repository Tab

---

# 45. FILE CONTEXT MENU

Unstaged file:

Stage

Discard Changes

Open File

Reveal in Finder / Explorer

Copy Path

Staged file:

Unstage

Open File

Copy Path

---

# 46. OPEN FILE

Cho phép double click file.

Có thể dùng:

shell.openPath()

Không expose shell trực tiếp cho renderer.

IPC:

system.openFile(path)

---

# 47. OS SUPPORT

Thiết kế cross-platform:

macOS
Windows
Linux

Path phải dùng:

node:path

Không hardcode:

/

Không giả định shell:

bash

Git command phải gọi executable trực tiếp.

---

# 48. COMMAND SAFETY

TUYỆT ĐỐI KHÔNG:

exec(
  `git commit -m "${message}"`
)

Vì có command injection.

Phải sử dụng:

spawn

hoặc:

execa

theo dạng arguments:

execa("git", [
   "-C",
   repoPath,
   "commit",
   "-m",
   message
])

---

# 49. GIT SERVICE

Xây GitService dạng:

class GitService {

    status(repoPath)

    getCurrentBranch(repoPath)

    getBranches(repoPath)

    getRemotes(repoPath)

    getLog(repoPath, options)

    getDiff(repoPath, file)

    getStagedDiff(repoPath, file)

    stage(repoPath, files)

    stageAll(repoPath)

    unstage(repoPath, files)

    commit(repoPath, message)

    checkout(repoPath, branch)

    createBranch(repoPath, branch, startPoint?)

    fetch(repoPath)

    pull(repoPath)

    push(repoPath)

    stash(repoPath, options)

    getStashes(repoPath)

    applyStash(repoPath, stash)

    popStash(repoPath, stash)

    dropStash(repoPath, stash)

}

Tất cả command Git tập trung tại service này.

Không để component React chạy Git command.

---

# 50. GIT EXECUTOR

Tạo helper:

GitExecutor

Ví dụ:

run(
    repoPath,
    args,
    options
)

Trách nhiệm:

- execute Git
- capture stdout
- capture stderr
- timeout
- cancel
- stream progress
- normalize errors
- logging

GitService sử dụng GitExecutor.

---

# 51. IPC

Ví dụ API preload:

window.git = {

    status(repositoryId),

    branches(repositoryId),

    log(repositoryId, options),

    diff(repositoryId, options),

    stage(repositoryId, files),

    unstage(repositoryId, files),

    commit(repositoryId, message),

    checkout(repositoryId, branch),

    pull(repositoryId),

    push(repositoryId),

    fetch(repositoryId),

    stash(repositoryId, options),

    stashPop(repositoryId, id)

}

Renderer không nên gửi arbitrary filesystem path cho mọi operation sau khi repository đã được register.

Main process nên map:

repositoryId
↓
validated repository path

Điều này giúp IPC an toàn hơn.

---

# 52. REPOSITORY REGISTRY

Main process lưu:

Map<
   RepositoryId,
   Repository
>

Repository:

{
   id
   path
   name
}

Renderer chỉ sử dụng:

repositoryId

cho hầu hết Git operations.

---

# 53. LOADING STATES

Các operation cần có loading state độc lập:

statusLoading
logLoading
fetching
pulling
pushing
committing

Không dùng duy nhất:

loading=true

cho toàn application.

---

# 54. EMPTY STATE

Khi chưa mở project:

Logo nhỏ

"Open a Git repository"

Button:

Open Repository

Recent repositories:

api-server
admin-web
mobile-app

---

# 55. FIRST DEVELOPMENT PHASE

Phase 1 phải chạy được hoàn chỉnh:

Open Repository

Multi-tabs

Git status

Current branch

Local branches

Remote branches

Commit graph

Unstaged files

Staged files

Stage

Unstage

Stage All

Diff

Commit

Checkout branch

Fetch

Pull

Push

Stash

Stash Pop

Dark UI

---

# 56. PHASE 2

Implement:

Create branch

Delete branch

Merge

Stash Apply

Stash Drop

Commit detail

Commit file diff

Branch context menus

Commit context menus

File system watching

Recent repositories

Keyboard shortcuts

Operation log

---

# 57. PHASE 3

Implement:

Merge conflicts UI

Cherry-pick

Revert

Reset

Tag

Interactive commit graph

Search commits

Filter history

Author filter

Branch filter

Commit graph optimization

Large repository performance

---

# 58. FUTURE FEATURES

Architecture phải cho phép thêm sau:

Rebase

Interactive Rebase

Git Flow

Git Worktree

Submodules

Git LFS

Bisect

Blame

Tag management

Remote management

Commit amend

Commit signing

Multiple remotes

Custom Git executable

Terminal

Open in VS Code

---

# 59. GRAPH UI DESIGN

Giao diện graph tham khảo screenshot Git client:

LEFT:

Branch / Tag

CENTER LEFT:

Graph lanes

CENTER:

Commit Message

RIGHT:

Author

RIGHT:

Date

Ví dụ:

BRANCH / TAG      GRAPH      COMMIT MESSAGE

staging             ●        Merge branch 'dev' into staging
                    │
dev                 ●        Merge branch 'fixbug/...'
                    │
                    ●        refactor: update ServiceLine
                    │
feature/search      ├──●     feat: search terminal
                    │  │
fixbug/add-cycle    │  ●     fixbug/add-cycle-information
                    │  │
                    ●──┘     Merge branch 'dev'
                    │
                    ●        WIP on fixbug/DSCB

Branch labels phải được render dạng badge.

Current branch:

✓ staging

Remote có icon cloud.

Local branch có icon branch / computer.

---

# 60. GRAPH INTERACTION

Hover commit:

highlight node

highlight graph lines

Click:

select commit

Double click:

open commit details

Right click:

context menu

Graph row selected:

highlight toàn bộ row.

---

# 61. UI RESIZE

Sidebar có thể resize.

Commit detail panel có thể resize.

Ví dụ:

| Sidebar | Commit Graph               | Details |
| 260px   | flexible                   | 400px   |

Dùng draggable split panes.

Persist kích thước UI.

---

# 62. USER EXPERIENCE

Mục tiêu:

Repository mở trong < 1 giây với repository bình thường.

Status refresh nhanh.

Không block UI.

Không reload Electron window sau Git operation.

Không mất selected commit sau refresh nếu commit vẫn còn.

Không reset scroll khi status thay đổi.

Không gọi lại toàn bộ git log khi user chỉ stage một file nếu HEAD không thay đổi.

Tách refresh:

refreshWorkingTree()

refreshRefs()

refreshHistory()

refreshStashes()

---

# 63. CACHE

Có thể cache:

branches
commit history
graph calculation

Invalidate đúng lúc.

Ví dụ:

stage file:

refresh status

KHÔNG cần refresh graph.

commit:

refresh status
refresh history
refresh branches

fetch:

refresh remote refs
refresh graph

checkout:

refresh status
refresh branch
refresh history

---

# 64. TESTING

Viết tests cho:

Git output parser

status parser

branch parser

log parser

stash parser

graph lane algorithm

Sử dụng temporary Git repositories trong integration test.

Ví dụ test:

initial commit

branch feature

2 commits

checkout main

commit

merge feature

Sau đó kiểm tra graph model.

---

# 65. README

README cần chứa:

Requirements

Node.js

Git installed

Install

npm install

Development

npm run dev

Build

npm run build

Packaging

npm run dist

Supported OS

macOS
Windows
Linux

Architecture overview

Security overview

---

# 66. ELECTRON PACKAGING

Sử dụng:

electron-builder

Build:

DMG cho macOS

NSIS cho Windows

AppImage/deb cho Linux

Scripts:

npm run dev

npm run build

npm run dist

---

# 67. DEVELOPMENT REQUIREMENT

Không tạo mock application.

Không tạo UI demo chỉ có dữ liệu fake.

Ngay từ Phase 1 phải kết nối thật với Git repository trên máy.

Mỗi feature cần:

UI
↓
IPC
↓
GitService
↓
Git CLI

hoạt động thực tế.

---

# 68. CODE QUALITY

Bắt buộc:

TypeScript strict mode.

Không sử dụng:

any

trừ trường hợp thực sự bắt buộc.

Tách:

Git parsing
Git execution
UI state
business logic
components

Không tạo một file App.tsx vài nghìn dòng.

Không duplicate Git command logic.

---

# 69. IMPLEMENTATION STRATEGY

Không cố viết toàn bộ ứng dụng cùng lúc.

Thực hiện lần lượt.

STEP 1

Scaffold:

Electron
React
Vite
TypeScript
Tailwind

Đảm bảo:

npm run dev

chạy được.

STEP 2

Implement RepositoryService.

Open folder.

Validate Git repository.

STEP 3

Implement GitExecutor.

STEP 4

Implement:

status
branch

STEP 5

Xây main layout.

STEP 6

Implement:

unstaged
staged
diff

STEP 7

Implement commit.

STEP 8

Implement branch sidebar.

STEP 9

Implement commit history.

STEP 10

Implement graph engine.

STEP 11

Implement:

checkout
fetch
pull
push

STEP 12

Implement stash.

STEP 13

Multi repository tabs.

STEP 14

Optimize / tests / packaging.

---

# 70. IMPORTANT DEVELOPMENT RULE

Sau mỗi STEP:

1. chạy TypeScript check
2. chạy lint
3. chạy tests
4. chạy application
5. sửa lỗi trước khi sang step tiếp theo

Không để TODO giả cho chức năng core.

Không để button không hoạt động.

Không implement UI trước rồi fake backend.

---

# 71. FIRST TASK

Bây giờ hãy bắt đầu triển khai application.

Đầu tiên:

1. phân tích architecture
2. tạo project structure
3. tạo package.json
4. cấu hình Electron + Vite + React + TypeScript
5. cấu hình Tailwind
6. tạo preload/contextBridge
7. tạo IPC architecture
8. tạo GitExecutor
9. tạo RepositoryService
10. xây chức năng Open Repository
11. đọc repository Git thật
12. hiển thị repository dưới dạng tab
13. hiển thị current branch
14. hiển thị Git status

Sau khi hoàn thành bước này mới tiếp tục sang:

branch sidebar
changes
diff
commit
graph
remote operations
stash.

Không hỏi lại những quyết định kỹ thuật nhỏ nếu có thể tự chọn giải pháp hợp lý.

Ưu tiên code chạy được, architecture sạch, khả năng mở rộng và trải nghiệm desktop tốt.