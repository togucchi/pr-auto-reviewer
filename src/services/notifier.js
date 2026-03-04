import notifier from 'node-notifier';
import path from 'path';

export function notifyComplete(pr, reportPath) {
  notifier.notify({
    title: 'PR Review Complete',
    message: `${pr.repo}#${pr.number}: ${pr.title}${reportPath ? '\n' + path.basename(reportPath) : ''}`,
    sound: 'Glass',
  });
}

export function notifyFailed(pr, error) {
  notifier.notify({
    title: 'PR Review Failed',
    message: `${pr.repo}#${pr.number}: ${error}`,
    sound: 'Basso',
  });
}
